"use client";
// Back-Office Reports > OTD & autonomy - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoOtdPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoOtdPage /></Suspense>;
}
