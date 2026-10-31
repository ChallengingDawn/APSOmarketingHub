// ESO Revenue & order intake is taken out (SARCLA 31.10.2026: "sub app take it out completely") - revenue and order
// intake per person and month are on the Figures page, where an old link to this address now lands.
import { redirect } from "next/navigation";

export default function RevenuePage() {
  redirect("/reporting/eso-benchmark/figures");
}
