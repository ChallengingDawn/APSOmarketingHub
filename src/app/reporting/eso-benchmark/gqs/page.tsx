"use client";
// ESO Reports > GQS (SARCLA 05.11.2026: "another tab on ESO and Sales leader on customer tickets, a new really developed tab to show
// results of GQS to sales leader and to be able to report it also on my reports"; on the tab inside Incoming tickets: "don't
// see at all") - the GQS tab of Incoming tickets as a page of its own, for ESO | TSA | Total and the line managers' teams.

import { Suspense } from "react";
import { TicketsExplorer } from "../Tickets";

export default function GqsPage() {
  return <Suspense><TicketsExplorer group="incoming" only="gqs" /></Suspense>;
}
