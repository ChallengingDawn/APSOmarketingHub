"use client";
// Sales Leader Reports > System tickets (SARCLA 02.11.2026: "the sales leader report should follow the same pattern as ESO, TSA or
// My Sales Reports") - ESO's own page, drawn whole for the people of the switch My team | Overall (../shared.tsx).

import { Suspense } from "react";
import { TicketsExplorer } from "@/app/reporting/eso-benchmark/Tickets";
import { LeaderFrame } from "../shared";

export default function Page() {
  return <Suspense><LeaderFrame><TicketsExplorer group="system" /></LeaderFrame></Suspense>;
}
