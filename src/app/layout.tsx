import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APSO Marketing Hub",
  description: "Marketing content generation for LinkedIn & Newsletters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-apso-gray min-h-screen">
        <nav className="bg-white border-b border-apso-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-apso-text tracking-wide">Angst+Pfister</span>
              <span className="text-lg font-bold text-apso-red tracking-wide">APSO</span>
            </div>
            <div className="h-5 w-px bg-apso-border" />
            <span className="text-sm text-apso-text">Marketing Hub</span>
          </div>
          <div className="flex gap-6 text-sm font-medium">
            <a href="/" className="text-apso-text hover:text-apso-red transition-colors">Dashboard</a>
            <a href="/linkedin" className="text-apso-text hover:text-apso-red transition-colors">LinkedIn</a>
            <a href="/newsletter" className="text-apso-text hover:text-apso-red transition-colors">Newsletter</a>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
