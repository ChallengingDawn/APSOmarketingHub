"use client";
// Customer Reports > Customer KPIs: Retention (SARCLA 01.11.2026: "based on what we know, think about what kind of dynamic KPI
// would be interesting here") - drawn in ../CustomerKpis.tsx.

import { Suspense } from "react";
import { CustomerKpisExplorer } from "../CustomerKpis";

export default function CustomerKpisPage() {
  return <Suspense><CustomerKpisExplorer page="retention" /></Suspense>;
}
