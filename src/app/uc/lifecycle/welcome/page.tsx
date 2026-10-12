"use client";

// UC2 WELCOME - new registrants, qualified and their first order.
// Reporting only: the UC runs as HubSpot workflows. See src/lib/lifecycle.

import LifecycleReport from "../LifecycleReport";

export default function WelcomePage() {
  return <LifecycleReport view="uc2" />;
}
