import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APSO Marketing Hub",
  description: "Marketing content generation for LinkedIn & Newsletters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-900">APSO</span>
            <span className="text-sm text-gray-500">Marketing Hub</span>
          </div>
          <div className="flex gap-4 text-sm">
            <a href="/" className="hover:text-blue-600">Dashboard</a>
            <a href="/linkedin" className="hover:text-blue-600">LinkedIn</a>
            <a href="/newsletter" className="hover:text-blue-600">Newsletter</a>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
