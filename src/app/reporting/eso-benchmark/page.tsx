// The ESO dashboard is sub-apps now (SARCLA 12.10), Visits first - this
// address, where the single page used to be, opens the first of them.
import { redirect } from "next/navigation";

export default function EsoBenchmark() {
  redirect("/reporting/eso-benchmark/visits");
}
