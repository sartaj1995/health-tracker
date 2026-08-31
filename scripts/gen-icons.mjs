// Generates the PNG app icons from scratch so the repo carries no binary
// assets it cannot rebuild. Run with: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12 stay zero: deflate, adaptive filtering, no interlace

  // One filter byte (0 = None) in front of every scanline.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Distance from a point to a line segment - used to stroke the pulse line. */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function drawIcon(size, { rounded = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = rounded ? size * 0.22 : 0;
  const stroke = size * 0.062;

  // A pulse trace, in fractions of the canvas.
  const path = [
    [0.14, 0.52], [0.31, 0.52], [0.4, 0.3], [0.52, 0.72],
    [0.62, 0.44], [0.69, 0.52], [0.86, 0.52],
  ].map(([x, y]) => [x * size, y * size]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded-square mask, antialiased over one pixel.
      let alpha = 1;
      if (rounded) {
        const cx = Math.min(Math.max(x + 0.5, radius), size - radius);
        const cy = Math.min(Math.max(y + 0.5, radius), size - radius);
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        alpha = Math.min(1, Math.max(0, radius - d + 0.5));
      }
      if (alpha <= 0) continue;

      // Diagonal cyan gradient, matching the app's palette. Both ends stay
      // dark enough that the white pulse holds at least 3:1 against them.
      const t = (x / size + y / size) / 2;
      let r = lerp(21, 8, t);    // #155E75 -> #0891B2
      let g = lerp(94, 145, t);
      let b = lerp(117, 178, t);

      // White pulse on top.
      let best = Infinity;
      for (let s = 0; s < path.length - 1; s++) {
        best = Math.min(
          best,
          distToSegment(x + 0.5, y + 0.5, path[s][0], path[s][1], path[s + 1][0], path[s + 1][1]),
        );
      }
      const ink = Math.min(1, Math.max(0, stroke / 2 - best + 0.5));
      r = lerp(r, 255, ink);
      g = lerp(g, 255, ink);
      b = lerp(b, 255, ink);

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

const targets = [
  ["public/apple-icon.png", 180, { rounded: false }], // iOS masks it itself
  ["public/icon-192.png", 192, {}],
  ["public/icon-512.png", 512, {}],
];

for (const [file, size, opts] of targets) {
  writeFileSync(file, drawIcon(size, opts));
  console.log(`wrote ${file} (${size}x${size})`);
}
