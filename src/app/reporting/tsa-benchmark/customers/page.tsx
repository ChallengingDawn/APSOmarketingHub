"use client";
// TSA Reports' Customer development (SARCLA 01.11.2026: "migrate to TSA now the customer development, but instead of
// default ESO, default is TSA") - ESO's page, at TSA's own address so the side panel stays TSA's, opening on TSA.

import { Suspense } from "react";
import { CustomerDevExplorer } from "@/app/reporting/eso-benchmark/CustomerDev";

export default function TsaCustomersPage() {
  return <Suspense><CustomerDevExplorer home="tsa" /></Suspense>;
}
