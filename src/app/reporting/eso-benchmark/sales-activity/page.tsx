"use client";
// Sales activity (SARCLA 05.11.2026: "build this report as a sub report on ESO and TSA master dashboard") - Diana's
// "Sales Activities x Companies Performance" dashboard with a choice of base and the potential beside the revenue: ../SalesActivity.tsx.

import { Suspense } from "react";
import { SalesActivityExplorer } from "../SalesActivity";

export default function SalesActivityPage() {
  return <Suspense><SalesActivityExplorer /></Suspense>;
}
