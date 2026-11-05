"use client";
// My Sales Reports > GQS (SARCLA 05.11.2026: "another tab on ESO and Sales leader on customer tickets, a new really developed tab to show
// results of GQS to sales leader and to be able to report it also on my reports"; on the tab inside Incoming tickets: "don't
// see at all") - the GQS tab of Incoming tickets as a page of its own, for the people of Mine | My team | All ESO | All - every graph, not the key ones only.

import { Suspense } from "react";
import { TicketsExplorer } from "@/app/reporting/eso-benchmark/Tickets";
import { MySalesFrame } from "../shared";

export default function Page() {
  return <Suspense><MySalesFrame><TicketsExplorer group="incoming" only="gqs" /></MySalesFrame></Suspense>;
}
