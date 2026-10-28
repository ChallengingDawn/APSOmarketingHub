import type { Metadata } from "next";
import localFont from "next/font/local";
import ThemeRegistry from "./ThemeRegistry";
import AppShell from "./AppShell";
import { SandboxMode } from "./SandboxMode";
import { isSandbox } from "@/lib/sandbox/mode";
import "./globals.css";

// THE FONTS LIVE IN THE REPO.
//
// next/font/google fetches from Google at BUILD time, and that fetch fails.
// Not rarely: five builds died on it in one day across three people, always
// with the same useless message —
//
//   An error occurred in `next/font`. TypeError: Cannot read properties of null
//
// It has nothing to do with the commit carrying it, which is why re-running
// always worked and why it kept being treated as bad luck rather than as a
// dependency on a network call inside a Docker build. A re-run also silently
// re-tags :prod, so one of those flakes shipped an older image than master.
//
// Local woff2, latin, variable: one file per family covering every weight,
// which is both smaller than seven static cuts and impossible to half-ship.
// The variable ranges are declared so the browser interpolates rather than
// faking a weight it does not have.
//
// The CSS variable names are unchanged ON PURPOSE. EditorCanvas reads the
// real family names out of them at runtime to draw text on the artboard, so
// renaming one would leave canvas text in a fallback while the DOM stayed
// correct — a split nobody would catch from a screenshot.
const inter = localFont({
  src: [{ path: "./fonts/Inter-latin.woff2", style: "normal", weight: "300 800" }],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});
const outfit = localFont({
  // 200 and 300 are the wordmark: Outfit is a different typeface at its light
  // weights, and that is the one this hub is set in.
  src: [{ path: "./fonts/Outfit-latin.woff2", style: "normal", weight: "200 800" }],
  variable: "--font-outfit",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "APSO Marketing Hub | Mission Control",
  description: "AI-powered marketing operations platform for APSOparts — SEO, content generation, and digital growth management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sandbox = isSandbox();
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <ThemeRegistry>
          <SandboxMode on={sandbox}>
            <AppShell sandbox={sandbox}>{children}</AppShell>
          </SandboxMode>
        </ThemeRegistry>
      </body>
    </html>
  );
}
