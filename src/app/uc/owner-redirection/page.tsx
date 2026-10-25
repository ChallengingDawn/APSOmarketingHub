"use client";

// OWNER REDIRECTION - a tab of Map assignment since 25.10.2026 (SARCLA: "owner redirection is not integrated on the page -
// it's on a separate page, that's what I could find"): this address opens it there. The board itself is
// OwnerRedirection.tsx; its rules (France -> Jeremy Borey, Sandra Kuridza -> James Koeremez, the people who have left)
// run as before.

import { useEffect } from "react";
import { LoadingPanel } from "@/app/analytics/Shell";

export default function OwnerRedirectionPage() {
  useEffect(() => { window.location.replace("/uc/map-assignment#redirections"); }, []);
  return <LoadingPanel label="Opening Redirections in Map assignment…" />;
}
