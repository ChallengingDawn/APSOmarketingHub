"use client";
// Products Reports > Minimum order (SARCLA 01.11.2026: "availability check on the shop where we didn't have stock and stuff like
// that - we should really create subtabs"; "all by sub app") - drawn in ../SignalsExplorer.tsx.

import { Suspense } from "react";
import { SignalsExplorer } from "../SignalsExplorer";

export default function MinimumOrderPage() {
  return <Suspense><SignalsExplorer kind="moq" /></Suspense>;
}
