// The footer bridge every store view should run (Content > Design > Configuration > Footer > Miscellaneous HTML).
// v10 (14.10.2026) trusts the shop tools' own gateways as well as DirectUP's; v11 (16.10.2026) also puts DirectUP in
// Quick Order's place (the main menu's last item and every /quickorder link). One constant for DirectUP's page and the
// four shop tools' pages, which all take their height from it.
export const CURRENT_BRIDGE = "v11-tools";

/** "v11-tools" -> 11; anything else -> 0. */
export function bridgeNumber(v: string | null | undefined): number {
  const m = /^v(\d+)-/.exec(String(v ?? ""));
  return m ? Number(m[1]) : 0;
}

/** This bridge or a newer one: a footer pasted ahead of the hub's own deploy is not "older". */
export function isCurrentBridge(v: string | null | undefined): boolean {
  return bridgeNumber(v) >= bridgeNumber(CURRENT_BRIDGE);
}
