"use client";
// Back-Office Reports > Sales tickets - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoSalesTicketsPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoSalesTicketsPage /></Suspense>;
}
