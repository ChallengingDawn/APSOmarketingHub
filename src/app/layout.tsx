import type { Metadata } from "next";
import ThemeRegistry from "./ThemeRegistry";
import AppShell from "./AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "APSO Marketing Hub | Mission Control",
  description: "AI-powered marketing operations platform for APSOparts — SEO, content generation, and digital growth management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
