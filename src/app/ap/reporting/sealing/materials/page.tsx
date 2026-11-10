"use client";
// Sealing Business Review > materials (the pilot's material families, then the compounds) - drawn in ../SealingReview.tsx.

import { Suspense } from "react";
import { SealingPage } from "../SealingReview";

export default function Page() {
  return <Suspense><SealingPage slug="materials" /></Suspense>;
}
