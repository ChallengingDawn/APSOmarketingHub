"use client";
// OTD Reports > compare - drawn in ../OtdReports.tsx.

import { Suspense } from "react";
import { OtdPage } from "../OtdReports";

export default function Page() {
  return <Suspense><OtdPage slug="compare" /></Suspense>;
}
