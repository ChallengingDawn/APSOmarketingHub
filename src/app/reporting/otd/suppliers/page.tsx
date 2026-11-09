"use client";
// OTD Reports > suppliers - drawn in ../OtdReports.tsx.

import { Suspense } from "react";
import { OtdPage } from "../OtdReports";

export default function Page() {
  return <Suspense><OtdPage slug="suppliers" /></Suspense>;
}
