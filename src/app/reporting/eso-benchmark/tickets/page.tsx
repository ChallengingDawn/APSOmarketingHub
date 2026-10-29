"use client";
// The ESO Tickets page, rebuilt like Visits (SARCLA 29.10.2026: tickets -> orders, per person) - ../Tickets.tsx.

import { Suspense } from "react";
import { TicketsExplorer } from "../Tickets";

export default function TicketsPage() {
  return <Suspense><TicketsExplorer /></Suspense>;
}
