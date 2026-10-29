"use client";
// Customer development, rebuilt like Visits (SARCLA 29.10.2026) - its own read and page: ../CustomerDev.tsx.

import { Suspense } from "react";
import { CustomerDevExplorer } from "../CustomerDev";

export default function CustomersPage() {
  return <Suspense><CustomerDevExplorer /></Suspense>;
}
