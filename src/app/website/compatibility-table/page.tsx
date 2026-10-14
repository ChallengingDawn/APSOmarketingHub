"use client";

// Compatibility table under Website > Microservices - its own gateway since 14.10.2026; the page is the one all four shop
// tools share (src/app/website/tools/ToolPage.tsx).
import ToolPage from "@/app/website/tools/ToolPage";

export default function Page() {
  return <ToolPage tool="compat" />;
}
