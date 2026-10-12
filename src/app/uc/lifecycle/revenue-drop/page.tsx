"use client";

// UC12 REVENUE DROP - the flags and the revenue after them.
// Reporting only: the UC runs as HubSpot workflows. See src/lib/lifecycle.

import LifecycleReport from "../LifecycleReport";

export default function RevenueDropPage() {
  return <LifecycleReport view="uc12" />;
}
