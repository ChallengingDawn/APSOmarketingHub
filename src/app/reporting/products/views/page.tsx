"use client";
// Products Reports > Views against orders (SARCLA 01.11.2026: "we should really create subtabs" - his pick) - drawn in
// ./ViewsOrders.tsx.

import { Suspense } from "react";
import { ViewsOrdersExplorer } from "./ViewsOrders";

export default function ViewsOrdersPage() {
  return <Suspense><ViewsOrdersExplorer /></Suspense>;
}
