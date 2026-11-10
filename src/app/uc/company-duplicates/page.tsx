import { redirect } from "next/navigation";

// Company duplicates moved inside Duplicates & merges (SARCLA 10.11.2026: "company duplicates should go inside of duplicates
// and merges, a main toggle on top") - the address it had for an hour leads there.
export default function CompanyDuplicatesMoved() {
  redirect("/uc/ticket-duplicates/companies");
}
