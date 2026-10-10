import type { NextConfig } from "next";

// CSP is intentionally pragmatic — Next.js + MUI need 'unsafe-inline' for
// emotion styles, and Anthropic/Google calls are server-side so we don't
// need to widen connect-src for them. Images allow data: URLs because
// Gemini returns base64-encoded image data we render inline.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Produce a lean, self-contained server bundle for the container image
  // (.next/standalone/server.js) — required for the AWS Fargate Dockerfile.
  output: "standalone",
  // The Compass connector's file steps (SFTP, the ERP workbook, the Magento XML)
  // run in the server: these stay plain node_modules instead of being bundled -
  // ssh2 carries optional native code a bundler cannot follow.
  serverExternalPackages: ["ssh2", "ssh2-sftp-client", "cpu-features", "exceljs"],
  // Guarantee runtime-read JSON data (brain seed, template specs) ships in
  // the standalone bundle — fs.readFile paths aren't always traced.
  outputFileTracingIncludes: {
    "/**": ["./src/data/**/*.json"],
  },
  // The GA4 site sub-apps moved from the Intelligence tabs to the Website area.
  async redirects() {
    return [
      { source: "/analytics", destination: "/website/overview", permanent: false },
      { source: "/analytics/acquisition", destination: "/website/acquisition", permanent: false },
      { source: "/analytics/audience", destination: "/website/audience", permanent: false },
      { source: "/analytics/signals", destination: "/analytics/buyers", permanent: false },
      // The generator log lives on the main platform now, so the page here went.
      // Anyone with it bookmarked lands in the studio it belonged to.
      { source: "/logs", destination: "/create", permanent: false },
      // The work queue IS /seo now; its old address keeps working.
      { source: "/seo/work-queue", destination: "/seo", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
