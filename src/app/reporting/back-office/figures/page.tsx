"use client";
// Back-Office Reports > Team totals (its address from when it was called Figures) - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoFiguresPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoFiguresPage /></Suspense>;
}
