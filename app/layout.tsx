import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ThemeSync } from "@/components/ThemeSync";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <StoreProvider>
          <ThemeSync />
          <ServiceWorker />
          <Nav />
          <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8">
            {children}
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
