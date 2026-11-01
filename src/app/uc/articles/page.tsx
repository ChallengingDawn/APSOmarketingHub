"use client";
// Articles CY/LY (Products Reports) - drawn in ./Articles.tsx. The address stays /uc/articles: it keeps the UC app's access
// rule and every link to it (categories.ts, the Compass connector's page).

import { Suspense } from "react";
import { ArticlesExplorer } from "./Articles";

export default function ArticlesPage() {
  return <Suspense><ArticlesExplorer /></Suspense>;
}
