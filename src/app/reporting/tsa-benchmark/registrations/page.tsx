"use client";
// TSA Reports' Registrations (SARCLA 01.11.2026: "we need to move it to TSA team ... bring the default TSA to TSA
// reports") - ESO's page, at TSA's own address so the side panel stays TSA's, opening on TSA; on TSA every visit chart is
// the qualified call's ("TSA don't do visits, they call, they do qualified calls").

import { Suspense } from "react";
import { RegistrationsExplorer } from "@/app/reporting/eso-benchmark/Registrations";

export default function TsaRegistrationsPage() {
  return <Suspense><RegistrationsExplorer home="tsa" /></Suspense>;
}
