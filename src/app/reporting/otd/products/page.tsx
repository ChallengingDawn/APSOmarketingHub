"use client";
// OTD Reports > products - drawn in ../OtdReports.tsx.

import { Suspense } from "react";
import { OtdPage } from "../OtdReports";

export default function Page() {
  return <Suspense><OtdPage slug="products" /></Suspense>;
}
