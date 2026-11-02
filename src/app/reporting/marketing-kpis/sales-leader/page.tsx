// The Sales leader view moved to a report of its own (SARCLA 20.10.2026), and that report opens on its team's targets
// since 02.11.2026 - an old link or bookmark goes there.
import { redirect } from "next/navigation";

export default function MovedSalesLeaderView() {
  redirect("/reporting/sales-leader/targets");
}
