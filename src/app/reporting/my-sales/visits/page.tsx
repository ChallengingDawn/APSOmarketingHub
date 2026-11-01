"use client";
// My Sales Reports > Visits (SARCLA 01.11.2026) - drawn in ../MyVisits.tsx.

import { Suspense } from "react";
import { MyVisitsPage } from "../MyVisits";

export default function Page() {
  return <Suspense><MyVisitsPage /></Suspense>;
}
