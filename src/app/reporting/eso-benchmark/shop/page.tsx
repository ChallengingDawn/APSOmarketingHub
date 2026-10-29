"use client";
// The ESO Shop behaviour page, rebuilt like the Figures and the Visits (SARCLA 29.10.2026: "rebuild like Figures/Visits") - ../Shop.tsx.

import { Suspense } from "react";
import { ShopExplorer } from "../Shop";

export default function ShopPage() {
  return <Suspense><ShopExplorer /></Suspense>;
}
