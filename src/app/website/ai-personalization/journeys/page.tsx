"use client";

// APSOconvert > Journeys: the visitors' main journeys inside the app's own menu (the same page as Visitor journeys >
// Main journeys - see ../base.ts); its sub-pages Funnel and Page flow sit under it. An address with ?path= (the links
// made before 08.11.2026 21:00) still opens that page's flow.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MainJourneys from "@/app/website/journeys/page";
import PageFlow from "@/app/website/journeys/page/page";

function Pick() {
  const sp = useSearchParams();
  return sp.get("path") ? <PageFlow /> : <MainJourneys />;
}

export default function ConvertJourneys() {
  return <Suspense fallback={null}><Pick /></Suspense>;
}
