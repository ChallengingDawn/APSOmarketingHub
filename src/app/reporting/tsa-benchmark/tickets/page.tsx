"use client";
// TSA Reports' Incoming tickets (SARCLA 01.11.2026: "move like the other the ticket also to TSA ... default TSA on TSA
// reports") - ESO's page, at TSA's own address so the side panel stays TSA's, opening on TSA: the TSA pipeline's tickets.

import { Suspense } from "react";
import { TicketsExplorer } from "@/app/reporting/eso-benchmark/Tickets";

export default function TsaIncomingTicketsPage() {
  return <Suspense><TicketsExplorer group="incoming" home="tsa" /></Suspense>;
}
