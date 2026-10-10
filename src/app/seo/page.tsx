"use client";

/**
 * /seo — THE WORK QUEUE, and nothing else.
 *
 * It used to open on Search performance: a page of numbers, with the list of
 * things to actually do three clicks away behind its own tab. Five sub-apps,
 * five scores in five units, and the reader left to reconcile them.
 *
 * Now the front door answers the only question somebody opens this area to ask
 * — what should I do first — and the analyses behind it are detail you click
 * into when you want to know why. The numbers moved to /seo/performance.
 */

import WorkQueue from "./WorkQueue";

export default function SeoPage() {
  return <WorkQueue />;
}
