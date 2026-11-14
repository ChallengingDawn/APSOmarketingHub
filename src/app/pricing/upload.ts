// Uploads from the Pricing pages while the hub is on its first address.
//
// The live hub's firewall (AWS WAF on the sandbox account's load balancer) refuses any request whose body is over 8 KB:
// a competitor's price file, a supplier's price list for the OCR, an Excel to ingest are all far larger. It answers
// with a bare 403 of its own, before the hub sees the request. Until the hub moves to its new address (Prod, no such
// limit), those files are uploaded on the PricingHub's old dashboard, which reads and writes the same data.

/** The old dashboard: the same data, kept until the hub moves. */
export const OLD_DASHBOARD = "https://apsopricinghub.com";

/** The firewall's refusal - a 403 that is not this hub's own JSON answer. */
export function refusedByFirewall(res: Response): boolean {
  return res.status === 403 && !(res.headers.get("content-type") ?? "").includes("json");
}

/** What to tell the person, with the old dashboard's page for this upload. */
export function firewallMessage(oldPath: string): string {
  return `The hub's firewall turned this file away: until the hub moves to its new address it lets nothing over 8 KB through. Upload it on the old dashboard meanwhile - ${OLD_DASHBOARD}${oldPath}`;
}
