"use client";
// An ESO page, drawn as Digital Growth's are (SARCLA 21.10.2026) - what it shows is in ../pages.tsx.

import { Suspense } from "react";
import { EsoExplorer } from "../EsoKit";
import { SHOP } from "../pages";

export default function ShopPage() {
  return <Suspense><EsoExplorer def={SHOP} /></Suspense>;
}
