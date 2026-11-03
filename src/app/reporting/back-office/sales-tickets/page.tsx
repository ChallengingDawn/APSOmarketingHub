"use client";
// Back-Office Reports > ESO & TSA tickets - drawn in ../BackOffice.tsx.

import { Suspense } from "react";
import { BoSalesTicketsPage } from "../BackOffice";

export default function Page() {
  return <Suspense><BoSalesTicketsPage /></Suspense>;
}
