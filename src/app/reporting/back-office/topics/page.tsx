"use client";
// Back-Office Reports > Topics - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoTopicsPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoTopicsPage /></Suspense>;
}
