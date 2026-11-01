"use client";
// TSA Reports' Shop behaviour (SARCLA 01.11.2026: "shop behaviour is finished - move it to TSA like the other one, keeping
// it default on TSA") - ESO's page, at TSA's own address so the side panel stays TSA's, opening on TSA.

import { Suspense } from "react";
import { ShopExplorer } from "@/app/reporting/eso-benchmark/Shop";

export default function TsaShopPage() {
  return <Suspense><ShopExplorer home="tsa" /></Suspense>;
}
