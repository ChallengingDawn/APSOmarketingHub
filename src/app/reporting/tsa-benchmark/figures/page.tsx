"use client";
// TSA Reports' Figures (SARCLA 01.11.2026: "move the figures also to TSA with TSA default") - ESO's page, at TSA's own
// address so the side panel stays TSA's, opening on TSA; its charts go to TSA's BUC View.

import { Suspense } from "react";
import { FiguresExplorer } from "@/app/reporting/eso-benchmark/Figures";

export default function TsaFiguresPage() {
  return <Suspense><FiguresExplorer home="tsa" /></Suspense>;
}
