"use client";

// UC15 LOST LEADS - the push for a first purchase.
// Reporting only: the UC runs as HubSpot workflows. See src/lib/lifecycle.

import LifecycleReport from "../LifecycleReport";

export default function LostLeadsPage() {
  return <LifecycleReport view="uc15" />;
}
