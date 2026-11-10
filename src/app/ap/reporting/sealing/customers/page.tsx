"use client";
// Sealing Business Review > customers - drawn in ../SealingReview.tsx.

import { Suspense } from "react";
import { SealingPage } from "../SealingReview";

export default function Page() {
  return <Suspense><SealingPage slug="customers" /></Suspense>;
}
