"use client";

// UC9 SECOND PURCHASE - the push for a second order.
// Reporting only: the UC runs as HubSpot workflows. See src/lib/lifecycle.

import LifecycleReport from "../LifecycleReport";

export default function SecondPurchasePage() {
  return <LifecycleReport view="uc9" />;
}
