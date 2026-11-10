"use client";
// Sealing Business Review > approvals (and the share of revenue with no approval written) - drawn in ../SealingReview.tsx.

import { Suspense } from "react";
import { SealingPage } from "../SealingReview";

export default function Page() {
  return <Suspense><SealingPage slug="approvals" /></Suspense>;
}
