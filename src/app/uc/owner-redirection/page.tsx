// OWNER REDIRECTION - gone 25.10.2026 (SARCLA: "that page should not exist"; "the override on the map is the
// redirection"). Its two rules are overrides on the map (France -> Jeremy Borey, SAE Kuridza Sandra -> James Koeremez);
// an old link lands on Map assignment.

import { redirect } from "next/navigation";

export default function OwnerRedirectionPage() {
  redirect("/uc/map-assignment");
}
