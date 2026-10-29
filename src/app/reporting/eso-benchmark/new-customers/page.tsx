"use client";
// The ESO New customers page, rebuilt like the Figures (SARCLA 29.10.2026: "rebuild like Figures/Visits") - ../NewCustomers.tsx.

import { Suspense } from "react";
import { NewCustomersExplorer } from "../NewCustomers";

export default function NewCustomersPage() {
  return <Suspense><NewCustomersExplorer /></Suspense>;
}
