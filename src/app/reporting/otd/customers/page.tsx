"use client";
// OTD Reports > customers - drawn in ../OtdReports.tsx (the explorer in ../OtdCustomers.tsx).

import { Suspense } from "react";
import { OtdPage } from "../OtdReports";

export default function Page() {
  return <Suspense><OtdPage slug="customers" /></Suspense>;
}
