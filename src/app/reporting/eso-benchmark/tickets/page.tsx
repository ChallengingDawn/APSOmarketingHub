"use client";
// ESO Incoming tickets - the customers' requests (SARCLA 30.10.2026: "split in 2 apps - Incoming Ticket and System
// tickets") - ../Tickets.tsx. The address stays the one the Tickets page had.

import { Suspense } from "react";
import { TicketsExplorer } from "../Tickets";

export default function IncomingTicketsPage() {
  return <Suspense><TicketsExplorer group="incoming" /></Suspense>;
}
