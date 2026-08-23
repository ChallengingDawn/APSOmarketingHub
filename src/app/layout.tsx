import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import ThemeRegistry from "./ThemeRegistry";
import AppShell from "./AppShell";
import "./globals.css";

// Self-hosted at build time (next/font) — the previous Google Fonts @import
// was blocked by our CSP, so the app silently fell back to Segoe UI/Arial.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "APSO Marketing Hub | Mission Control",
  description: "AI-powered marketing operations platform for APSOparts — SEO, content generation, and digital growth management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <ThemeRegistry>
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
