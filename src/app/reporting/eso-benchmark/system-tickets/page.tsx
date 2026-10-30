"use client";
// ESO System tickets - what a workflow or a push hands the ESO (SARCLA 30.10.2026: "split in 2 apps - Incoming Ticket
// and System tickets") - ../Tickets.tsx.

import { Suspense } from "react";
import { TicketsExplorer } from "../Tickets";

export default function SystemTicketsPage() {
  return <Suspense><TicketsExplorer group="system" /></Suspense>;
}
