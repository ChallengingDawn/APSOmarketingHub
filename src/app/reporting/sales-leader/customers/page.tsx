"use client";
// Sales Leader Reports > Customer development (SARCLA 02.11.2026: "the sales leader report should follow the same pattern as ESO, TSA or
// My Sales Reports") - ESO's own page, drawn whole for the people of the switch My team | Overall (../shared.tsx).

import { Suspense } from "react";
import { CustomerDevExplorer } from "@/app/reporting/eso-benchmark/CustomerDev";
import { LeaderFrame } from "../shared";

export default function Page() {
  return <Suspense><LeaderFrame><CustomerDevExplorer /></LeaderFrame></Suspense>;
}
