"use client";

// UC13 REACTIVATION - Churn / Reactivate and what followed.
// Reporting only: the UC runs as HubSpot workflows. See src/lib/lifecycle.

import LifecycleReport from "../LifecycleReport";

export default function ReactivationPage() {
  return <LifecycleReport view="uc13" />;
}
