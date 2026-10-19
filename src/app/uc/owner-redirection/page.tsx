// OWNER REDIRECTION - since 19.10.2026 a view of Map assignment, not a HubSpot app of its own (SARCLA: "Owner
// redirection is now a part of Map assignment, so it should be taken out as a sub-app"). Old links and bookmarks land
// on that view; the board itself is OwnerRedirection.tsx. Its rules, API and HubSpot function are unchanged.

import { redirect } from "next/navigation";

export default function OwnerRedirectionPage() {
  redirect("/uc/map-assignment#redirections");
}
