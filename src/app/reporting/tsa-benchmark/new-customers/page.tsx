"use client";
// TSA Reports' New customers (SARCLA 01.11.2026: "transfer also this to TSA reports new customer") - ESO's page, at TSA's
// own address so the side panel stays TSA's, opening on TSA.

import { Suspense } from "react";
import { NewCustomersExplorer } from "@/app/reporting/eso-benchmark/NewCustomers";

export default function TsaNewCustomersPage() {
  return <Suspense><NewCustomersExplorer home="tsa" /></Suspense>;
}
