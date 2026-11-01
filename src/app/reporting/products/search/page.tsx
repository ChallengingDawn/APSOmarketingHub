"use client";
// Products Reports > Search (SARCLA 01.11.2026: "we should really create subtabs" - his pick) - drawn in ./SiteSearch.tsx.

import { Suspense } from "react";
import { SiteSearchExplorer } from "./SiteSearch";

export default function SiteSearchPage() {
  return <Suspense><SiteSearchExplorer /></Suspense>;
}
