"use client";
// The ESO Visits page, rebuilt like the Figures (SARCLA 27.10.2026: "review completely the visits") - ../Visits.tsx. Its TSA
// is TSA's Calls (SARCLA 01.11.2026: "when you switch to ESO the visits should appear and vice versa") - ../Calls.tsx.

import { Suspense } from "react";
import { CallsOrVisits } from "../Calls";

export default function VisitsPage() {
  return <Suspense><CallsOrVisits home="eso" /></Suspense>;
}
