"use client";
// The ESO Registrations page, rebuilt like the Visits and the Figures (SARCLA 29.10.2026) - ../Registrations.tsx.

import { Suspense } from "react";
import { RegistrationsExplorer } from "../Registrations";

export default function RegistrationsPage() {
  return <Suspense><RegistrationsExplorer /></Suspense>;
}
