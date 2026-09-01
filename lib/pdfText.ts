/**
 * Turns a PDF lab report into the plain text the report parser already reads.
 *
 * Reports arrive as PDFs in email, and the copy-the-text step is where logging
 * from a phone gives up: selecting text in a mobile PDF viewer is miserable,
 * and half the time the layout comes out shredded anyway. Reading the file
 * directly removes that step.
 *
 * Like the parser it feeds, this runs entirely in the browser — pdf.js is
 * loaded on demand and the bytes never leave the device. See lib/labImport.ts
 * for why that matters here.
 */

/** One positioned run of text, the shape pdf.js reports per glyph group. */
export type TextRun = {
  str: string;
  /** PDF user space: origin bottom-left, so y grows upward. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A PDF has no notion of a line — only runs of glyphs at coordinates. Two runs
 * belong to the same line when their baselines are within half a character
 * height of each other, which absorbs the sub-pixel wobble of reports that draw
 * every table cell separately without merging two adjacent rows into one.
 */
function sameLine(run: TextRun, baseline: number): boolean {
  const tolerance = Math.max(1, (run.height || 8) * 0.5);
  return Math.abs(run.y - baseline) <= tolerance;
}

/**
 * Rebuild one line from the runs sitting on it.
 *
 * The gap test is the part that matters: a report's columns are separated by
 * real horizontal space, but the fragments of a single word are not. Joining
 * everything with a space would split "Cholesterol" into two tokens the alias
 * matcher never sees; joining with nothing would weld a metric name onto its
 * value.
 */
function joinLine(runs: TextRun[]): string {
  const ordered = [...runs].sort((a, b) => a.x - b.x);
  let out = "";
  let prevEnd = 0;
  let prevHeight = 0;

  for (const run of ordered) {
    if (out !== "" && run.x - prevEnd > Math.max(1, prevHeight * 0.2)) out += " ";
    out += run.str;
    prevEnd = run.x + run.width;
    prevHeight = run.height || prevHeight;
  }

  return out.replace(/\s+/g, " ").trim();
}

/** Group positioned runs into text lines, top of the page first. */
export function linesFromRuns(runs: TextRun[]): string[] {
  const sorted = runs
    .filter((run) => run.str !== "")
    // y descending: PDF y grows upward, and a report reads top to bottom.
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: string[] = [];
  let current: TextRun[] = [];
  // Compared against the first run of the line rather than the previous one, so
  // a row of slightly uneven cells cannot drift into the row beneath it.
  let baseline = 0;

  for (const run of sorted) {
    if (current.length === 0) {
      baseline = run.y;
      current.push(run);
    } else if (sameLine(run, baseline)) {
      current.push(run);
    } else {
      lines.push(joinLine(current));
      current = [run];
      baseline = run.y;
    }
  }
  if (current.length > 0) lines.push(joinLine(current));

  return lines.filter((line) => line !== "");
}

/** Anything larger is a scan or a mistake, not a lab report. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Reports run to a few pages; a cap keeps a wrong file from locking the tab. */
export const MAX_PDF_PAGES = 30;

export class PdfTextError extends Error {}

type PdfItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function toRun(item: PdfItem): TextRun | null {
  const transform = item.transform;
  if (typeof item.str !== "string" || !transform || transform.length < 6) return null;
  return {
    str: item.str,
    x: transform[4],
    y: transform[5],
    width: item.width ?? 0,
    // Some producers report height 0; the matrix's vertical scale is the
    // fallback, and it is what the tolerances above are really asking for.
    height: item.height || Math.abs(transform[3]) || 0,
  };
}

/**
 * Extract the text of a PDF, laid out line by line.
 *
 * pdf.js is imported here rather than at module scope so the ~1 MB of it is a
 * separate chunk that only downloads for someone who actually picks a PDF.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Bundled alongside the app rather than fetched from a CDN: an offline PWA
  // cannot reach a CDN, and a health app should not be asking one for anything.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  // Nothing here is rendered, only read, so the font machinery is switched off:
  // it is the part that would otherwise reach for the network, and an offline
  // PWA reading a private document should be asking for nothing at all.
  //
  // Warnings are muted for the same reason. pdf.js asks for `standardFontDataUrl`
  // — 820 kB of glyph outlines for drawing the non-embedded standard fonts —
  // and grumbles once per document when it is missing. Extraction never needs
  // them: character codes come from the font's encoding and ToUnicode map, not
  // from its outlines. Errors still come through.
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "PasswordException") {
      throw new PdfTextError(
        "That PDF is password-protected. Open it in a PDF reader, save an unlocked copy, and try again.",
      );
    }
    throw new PdfTextError("That file could not be read as a PDF.");
  }

  try {
    const pages: string[] = [];
    const count = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const runs = (content.items as PdfItem[])
        .map(toRun)
        .filter((run): run is TextRun => run !== null);
      pages.push(linesFromRuns(runs).join("\n"));
      page.cleanup();
    }
    return pages.join("\n").trim();
  } finally {
    await loadingTask.destroy();
  }
}

/** Read a picked file, with the guards that keep a wrong pick cheap. */
export async function textFromPdfFile(file: File): Promise<string> {
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfTextError(
      `That file is ${Math.round(file.size / 1024 / 1024)} MB. Lab reports are far smaller — check you picked the right one.`,
    );
  }

  const text = await extractPdfText(await file.arrayBuffer());

  if (text === "") {
    throw new PdfTextError(
      "No text found in that PDF — it is probably a scan or a photo, which is a picture of a report rather than a report. Type the readings in by hand, or paste the text if you can get at it.",
    );
  }

  return text;
}
