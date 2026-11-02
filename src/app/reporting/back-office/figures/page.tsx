"use client";
// Back-Office Reports > Figures - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoFiguresPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoFiguresPage /></Suspense>;
}
