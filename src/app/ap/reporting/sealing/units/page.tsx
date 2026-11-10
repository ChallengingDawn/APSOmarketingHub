"use client";
// Sealing Business Review > business units - drawn in ../SealingReview.tsx.

import { Suspense } from "react";
import { SealingPage } from "../SealingReview";

export default function Page() {
  return <Suspense><SealingPage slug="units" /></Suspense>;
}
