"use client";

// /seo/work-queue — WHAT TO DO NEXT.
//
// This route is new, and its absence was a real fault rather than a gap: the
// tab bar had carried a "Work queue" tab pointing here since the cockpit was
// built, and there was no page at the other end. Clicking it answered 404,
// while the queue itself sat on /seo wearing the label "Performance".
//
// Now the queue lives at the address its tab always claimed, and /seo is the
// overview it was labelled as all along.

import WorkQueue from "../WorkQueue";

export default function WorkQueuePage() {
  return <WorkQueue />;
}
