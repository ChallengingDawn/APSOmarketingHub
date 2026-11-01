"use client";
// My Sales Reports > Shop behaviour (SARCLA 01.11.2026: "the other sub-reports on ESO should be brought to give value to the sales - all
// with filtering and saving views") - ESO's own page, drawn whole for the people of My Sales' switch (../shared.tsx).

import { Suspense } from "react";
import { ShopExplorer } from "@/app/reporting/eso-benchmark/Shop";
import { MySalesFrame } from "../shared";

export default function Page() {
  return <Suspense><MySalesFrame><ShopExplorer /></MySalesFrame></Suspense>;
}
