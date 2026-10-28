// THE MICROSERVICES IN A SANDBOX: THROUGH THE DOOR, READ ONLY (SARCLA 28.10.2026: "how we can bring the data from the
// microservices ... maybe via the existing gateway?"). The hub reads its gateways with their admin keys, which can also
// change what the shop runs; a sandbox holds none of them. It reads through the door on the Smart-Search gateway
// (SANDBOX_VIEWER_URL) with the person's own viewer key (SANDBOX_VIEWER_KEY): GET only, the reads the hub's pages make,
// and the door adds each service's key on Railway. Every gateway client of the hub turns here first when isSandbox().

export type DoorService = "search-bar" | "ads" | "directup" | "directcut" | "3d";

/** A read through the door - the path as the hub's own client would ask its service. Anything but a read is refused here. */
export async function doorGet<T>(service: DoorService, path: string, init: { method?: string; timeoutMs?: number } = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") throw new Error("A sandbox only reads the microservices - this would change the live one");
  const base = (process.env.SANDBOX_VIEWER_URL ?? "").trim().replace(/\/+$/, "");
  const key = (process.env.SANDBOX_VIEWER_KEY ?? "").trim();
  if (!base || !key) throw new Error("No door to the microservices: set SANDBOX_VIEWER_URL and SANDBOX_VIEWER_KEY in .env.local");
  const res = await fetch(`${base}/viewer/${service}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: { "x-viewer-key": key }, signal: AbortSignal.timeout(init.timeoutMs ?? 30_000), cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    let why = "";
    try { why = (JSON.parse(body) as { error?: string }).error ?? ""; } catch { /* not JSON */ }
    throw new Error(res.status === 401 || res.status === 403
      ? `The door refused your viewer key${why ? ` (${why})` : ""}`
      : `The door answered ${res.status}${why ? `: ${why}` : ""}`);
  }
  return (body ? JSON.parse(body) : null) as T;
}
