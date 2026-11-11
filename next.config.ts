import type { NextConfig } from "next";

// CSP is intentionally pragmatic — Next.js + MUI need 'unsafe-inline' for
// emotion styles, and Anthropic/Google calls are server-side so we don't
// need to widen connect-src for them. Images allow data: URLs because
// Gemini returns base64-encoded image data we render inline, and the shop's
// own image host: the search bar's featured products show their shop picture
// (SARCLA 17.10.2026: "feature pictures are broken").
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // ...and our HubSpot portal's files: a newsletter started from one of our e-mails keeps its pictures (08.11.2026)
  "img-src 'self' data: blob: https://www.apsoparts.com https://26492587.fs1.hubspotusercontent-eu1.net https://dss0ijjcuug27.cloudfront.net",
  "font-src 'self' data:",
  "connect-src 'self'",
  // our e-mails' web versions, shown as they went out in the newsletter studio's "Our e-mails" (08.11.2026)
  "frame-src 'self' https://campaigns.apsoparts.com",
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
    return [
      // every address but APSOconvert's live preview, which the hub's own pages frame - it sends its own rules
      // (src/app/api/website/ai-personalization/preview/route.ts: framed by the hub only, sandboxed, no request out)
      { source: "/:path((?!api/website/ai-personalization/preview$).*)", headers: securityHeaders },
      {
        source: "/api/website/ai-personalization/preview",
        headers: securityHeaders.filter((h) => !["Content-Security-Policy", "X-Frame-Options", "Referrer-Policy"].includes(h.key)),
      },
    ];
  },
};

export default nextConfig;
