"use client";
// OTD Reports > lead - drawn in ../OtdReports.tsx.

import { Suspense } from "react";
import { OtdPage } from "../OtdReports";

export default function Page() {
  return <Suspense><OtdPage slug="lead" /></Suspense>;
}
