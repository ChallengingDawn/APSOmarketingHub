"use client";
// The ESO reports' Figures: revenue and order intake per month and per person, ESO | TSA | Total (SARCLA 24.10.2026) -
// drawn in ../Figures.tsx.

import { Suspense } from "react";
import { FiguresExplorer } from "../Figures";

export default function FiguresPage() {
  return <Suspense><FiguresExplorer /></Suspense>;
}
