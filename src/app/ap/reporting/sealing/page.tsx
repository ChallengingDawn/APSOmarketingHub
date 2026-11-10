"use client";
// Sealing Business Review > overview - drawn in ./SealingReview.tsx (the pages: src/lib/apHub/sealingPages.ts).

import { Suspense } from "react";
import { SealingPage } from "./SealingReview";

export default function Page() {
  return <Suspense><SealingPage slug="overview" /></Suspense>;
}
