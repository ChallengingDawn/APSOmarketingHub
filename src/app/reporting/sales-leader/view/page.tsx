// The KPIs tagged for the sales leader left Sales Leader Reports (SARCLA 02.11.2026, his pick: "keep Team, drop the old
// view" - the report follows ESO's and My Sales Reports' pattern) - an old link or bookmark lands on its Targets.
import { redirect } from "next/navigation";

export default function DroppedSalesLeaderView() {
  redirect("/reporting/sales-leader/targets");
}
