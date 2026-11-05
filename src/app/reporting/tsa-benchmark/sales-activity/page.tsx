"use client";
// TSA Reports' Sales activity - ESO's page, at TSA's own address so the side panel stays TSA's, opening on TSA.

import { Suspense } from "react";
import { SalesActivityExplorer } from "@/app/reporting/eso-benchmark/SalesActivity";

export default function TsaSalesActivityPage() {
  return <Suspense><SalesActivityExplorer home="tsa" /></Suspense>;
}
