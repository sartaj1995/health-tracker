/**
 * The colour the browser paints its own chrome with — the address bar on
 * Android, the status bar area of an installed PWA.
 *
 * These must track `--bg` in globals.css. They live here rather than in a
 * `viewport.themeColor` export because that only supports
 * `prefers-color-scheme`, which follows the OS. This app lets you override the
 * OS from Settings, so choosing Dark on a light phone would leave a light bar
 * above a dark app. Owning the tag ourselves is what keeps the two in step.
 */
export const THEME_COLORS = {
  light: "#f4f7f8",
  dark: "#0b0f14",
} as const;

/** Point the single theme-color meta tag at the theme now on screen. */
export function applyThemeColor(dark: boolean): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
}
