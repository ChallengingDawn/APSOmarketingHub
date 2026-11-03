"use client";
// Back-Office Reports > Stopped orders - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoStoppedPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoStoppedPage /></Suspense>;
}
