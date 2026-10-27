"use client";
// The ESO Visits page, rebuilt like the Figures (SARCLA 27.10.2026: "review completely the visits") - ../Visits.tsx.

import { Suspense } from "react";
import { VisitsExplorer } from "../Visits";

export default function VisitsPage() {
  return <Suspense><VisitsExplorer /></Suspense>;
}
