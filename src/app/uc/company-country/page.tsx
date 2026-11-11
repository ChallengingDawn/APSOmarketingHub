// The Country page lived here for a few hours on 11.11.2026; SARCLA moved it the same day into Duplicates & merges >
// Companies ("for the country correction it should be a tab here"). An old link lands on the tab.

import { redirect } from "next/navigation";

export default function CompanyCountryMoved() {
  redirect("/uc/ticket-duplicates/companies#country");
}
