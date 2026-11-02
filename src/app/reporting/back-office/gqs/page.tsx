"use client";
// Back-Office Reports > GQS - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoGqsPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoGqsPage /></Suspense>;
}
