"use client";

// UC4 ABANDONED CART - carts, tickets and the orders after them.
// Reporting only: the UC runs as HubSpot workflows. See src/lib/lifecycle.

import LifecycleReport from "../LifecycleReport";

export default function AbandonedCartPage() {
  return <LifecycleReport view="uc4" />;
}
