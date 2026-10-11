"use client";

/**
 * /seo — the overview.
 *
 * The queue moved to /seo/work-queue, which is the address its own tab had
 * been pointing at all along. This is the front door the tab bar and the
 * sidebar both called it.
 */

import Overview from "./Overview";

export default function SeoPage() {
  return <Overview />;
}
