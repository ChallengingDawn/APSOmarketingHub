"use client";
// Sales Leader Reports > New customer contest - the same page as My Sales Reports' (Diana Fehr 06.11.2026, for Bernd
// Rausmann's team and the others): Sales Leader Reports lists ESO's pages as My Sales Reports has them (SARCLA 02.11.2026).
// The contest is ESO's whole - every team side by side - so it has no My team | Overall switch.

import { Suspense } from "react";
import { ContestPage } from "@/app/reporting/my-sales/Contest";

export default function Page() {
  return <Suspense><ContestPage /></Suspense>;
}
