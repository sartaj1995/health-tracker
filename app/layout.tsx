import type { Metadata, Viewport } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import { DriveAutoBackup } from "@/components/DriveAutoBackup";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ThemeSync } from "@/components/ThemeSync";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

// Self-hosted at build time: no external request, no flash of unstyled text,
// and no layout shift when the face swaps in.
const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Health Tracker",
  description:
    "Log your weight, BMI, vitamin D, cholesterol and other health metrics, and see how they move over time.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Health", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

/**
 * Applies the saved theme before first paint. Without this the page flashes
 * light before React hydrates and reads localStorage.
 */
const themeBootstrap = `
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem("ht.profile.v1") || "{}");
    var mode = saved.theme || "system";
    var dark = mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${firaSans.variable} ${firaCode.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <StoreProvider>
          <ThemeSync />
          <ServiceWorker />
          <DriveAutoBackup />
          <Nav />
          <main
            id="main"
            className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8"
          >
            {children}
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
