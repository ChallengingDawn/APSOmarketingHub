"use client";
// TSA Reports' Calls (SARCLA 01.11.2026: "TSA don't do visits, they call, they do qualified calls ... build instead of
// visits on TSA a sub report for calls") - ../../eso-benchmark/Calls.tsx, at TSA's own address, opening on TSA.

import { Suspense } from "react";
import { CallsExplorer } from "@/app/reporting/eso-benchmark/Calls";

export default function TsaCallsPage() {
  return <Suspense><CallsExplorer /></Suspense>;
}
