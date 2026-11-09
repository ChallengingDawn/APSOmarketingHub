"use client";
// OTD Reports > overview - drawn in ./OtdReports.tsx.

import { Suspense } from "react";
import { OtdPage } from "./OtdReports";

export default function Page() {
  return <Suspense><OtdPage slug="overview" /></Suspense>;
}
