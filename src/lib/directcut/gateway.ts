// DIRECTCUT — the hub's page on the cut-to-size tool (SARCLA, 16.10.2026: "only migrate what is possible,
// don't break anything; it's also more the dashboard at this point").
//
// WHAT STAYS ON RAILWAY, AND WHY IT IS NOT A CHOICE. The c2s-middleware is DirectCut's gateway: it serves the
// widget and it IS the reservation authority. Two things keep it there.
//
//   1. The shop's customers are anonymous people on the public internet, and this hub is not publicly
//      reachable — its DNS resolves to eu-central-1 but the host answers only on the A+P network.
//   2. The middleware is single-instance BY DESIGN. Its area holds and its cut ledger live in two RAM maps
//      (store.RESERVATIONS, cut-ledger.LEDGERS), hydrated from Postgres at boot only — "the request path
//      never waits on Postgres… memory always wins". Add eight setInterval timers and a Magento order cursor
//      in the database. Two instances would be two independent ledgers promising the same plate area to two
//      customers, with nothing to detect it. The hub's service runs two tasks, and an ECS rolling deploy
//      overlaps two even at desiredCount 1.
//
// So this page is a READ-ONLY MIRROR of what the Railway dashboard shows, and there is deliberately no write
// path to the middleware here: no reserve, no cancel, no stage move. Acting on a line stays in the dashboard
// until this page has been watched for a while. The only thing an admin can change is which gateway address
// the hub reads, exactly as on DirectUP and the 3D gateway.
//
// Key: C2S_ADMIN_KEY (the same value the middleware holds; C:\dev\secrets\c2s-admin.key). It needs to reach
// the task as a secret — see reference_apsomh_deploy: a new task-definition revision built from the LATEST
// one, then a hand deploy with no --task-definition.

import { DOOR_KEY, isSandbox } from "@/lib/sandbox/mode";
import { doorGet } from "@/lib/sandbox/viewer";
import { kvGet, kvSet } from "@/lib/db/init";
import { slim, type Board, type RawPipeline } from "./board";

export { slim, STAGES, MANUAL_FROM, canMove } from "./board";
export type { Board, Line, Stage, StockRow } from "./board";

export const DEFAULT_GATEWAY = "https://c2s-middleware-production.up.railway.app";
const KV = "directcut:gateway";

export type GatewaySetting = { url: string; by: string | null; at: string | null; fromDefault: boolean };

export async function gatewaySetting(): Promise<GatewaySetting> {
  const s = await kvGet<{ url: string; by: string; at: string }>(KV).catch(() => null);
  return s?.url ? { url: s.url, by: s.by, at: s.at, fromDefault: false } : { url: DEFAULT_GATEWAY, by: null, at: null, fromDefault: true };
}

/** https only, no path — the service's origin, as the shop frames it. */
export async function setGateway(raw: string, by: string): Promise<GatewaySetting> {
  let origin = "";
  try { origin = new URL(raw.trim()).origin; } catch { /* below */ }
  if (!origin.startsWith("https://")) throw new Error(`Give the gateway's https address, e.g. ${DEFAULT_GATEWAY}`);
  const s = { url: origin, by, at: new Date().toISOString() };
  await kvSet(KV, s);
  return { ...s, fromDefault: false };
}

export function adminKey(): string | null {
  if (isSandbox()) return DOOR_KEY;
  const v = (process.env.C2S_ADMIN_KEY || "").trim();
  return v ? v : null;
}

/* ONE WRITE, ADDED DELIBERATELY (18.10.2026). SARCLA: "if the hub can do it would be great" — moving a
   line's stage and closing one were the last reasons to keep the Railway dashboard open.

   This does NOT weaken the rule at the top of this file. That rule is about the LEDGER: the middleware
   stays the single reservation authority, and the hub never computes availability, never holds plate area
   and never decides what a line is. A stage move is not a second opinion about stock — it is a person
   saying "this one is cut" or "forget this one", which the middleware then applies with its own rules
   (MANUAL_FROM: to-cut only from ordered, cut-done from ordered or to-cut, closed from anywhere, and no
   way back from cut-done because it releases plate area). The hub asks; the middleware still decides and
   can still refuse with 409.
   
   Kept separate from gateway() so that every write is visible as a write at the call site. */
export async function gatewayPost<T>(path: string, body: unknown, timeoutMs = 25_000): Promise<T> {
  if (isSandbox()) throw new Error("A sandbox only reads the microservices - this would change the live one");
  const key = adminKey();
  if (!key) throw new Error("C2S_ADMIN_KEY is not set on the hub");
  const base = (await gatewaySetting()).url;
  const res = await fetch(`${base}/api/c2s${path}`, {
    method: "POST",
    headers: { "x-admin-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await res.text();
  let out: unknown = null;
  try { out = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = out && typeof out === "object" && "error" in out ? String((out as { error: unknown }).error) : text.slice(0, 160);
    throw Object.assign(
      new Error(res.status === 409 ? `The middleware refused that move: ${said}`
        : res.status === 403 ? "The gateway refused the hub's key (C2S_ADMIN_KEY differs)"
        : `The gateway answered ${res.status}: ${said}`),
      { status: res.status },
    );
  }
  return out as T;
}

export async function setStage(key: string, stage: string, note: string) {
  return gatewayPost<{ ok: boolean; error?: string; stage?: string }>(
    `/admin/cuts/${encodeURIComponent(key)}/stage`, { stage, note });
}

/** One READ of the middleware's admin API. */
export async function gateway<T>(path: string, timeoutMs = 25_000): Promise<T> {
  // a sandbox reads through the door and holds no key (src/lib/sandbox/viewer.ts)
  if (isSandbox()) return doorGet<T>("directcut", path, { timeoutMs });
  const key = adminKey();
  if (!key) throw new Error("C2S_ADMIN_KEY is not set on the hub");
  const base = (await gatewaySetting()).url;
  const res = await fetch(`${base}/api/c2s${path}`, {
    headers: { "x-admin-key": key },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : text.slice(0, 160);
    throw Object.assign(
      new Error(res.status === 403
        ? "The gateway refused the hub's key (C2S_ADMIN_KEY differs)"
        : `The gateway answered ${res.status}: ${said}`),
      { status: res.status },
    );
  }
  return body as T;
}

export async function board(doneShown?: number): Promise<Board> {
  // 40 s: the pipeline is the middleware's heaviest read (p50 391 ms measured, but it walks the whole ledger)
  return slim(await gateway<RawPipeline>("/admin/pipeline", 40_000), doneShown);
}

/* ── the registry, and the area actually held ────────────────────────────────
   Both of these existed on the Railway dashboard and were missing here (SARCLA, 17.10.2026: "we dont have
   anymore the article that are created and the holding of na article since basket"). They answer two
   different questions that the board cannot:

     the registry  - every cut-article number this ledger ever MINTED, so a number arriving on an order can
                     be recognised at all. A line in "ordered by number only" is precisely a number that is
                     NOT in here.
     the holds     - the plate area a basket is sitting on right now, with whose basket it is and when it
                     lapses. A hold is why a plate the shelf shows is not actually free.

   The `size` string the middleware sends is mis-encoded ("304Ã—95"), so the size is rebuilt from l and w. */

export type RegistryRow = {
  cutArticle: string; basisArticle: string; l: number; w: number; thickness: number | null;
  firstSeen: string | null; lastSeen: string | null; seenCount: number;
  lastOrderNo: string | null; lastLineId: string | null;
  /** the ERP's number for that order, once Compass has reconciled it (layered on, never stored) */
  lastOrderErpNo?: string | null;
};
export type Registry = { total: number; rows: RegistryRow[] };

export async function registry(q = "", limit = 300): Promise<Registry> {
  const qs = new URLSearchParams({ limit: String(Math.min(1000, Math.max(1, limit))) });
  if (q) qs.set("q", q);
  /* the /refs form layers the A-number onto each row's last order (SARCLA: "last order should use A
     number"). It falls back to the plain list, so an older middleware still answers. */
  let r: { total?: number; rows?: RegistryRow[] };
  try {
    r = await gateway<{ total?: number; rows?: RegistryRow[] }>(`/cut-articles/refs?${qs}`, 30_000);
  } catch {
    r = await gateway<{ total?: number; rows?: RegistryRow[] }>(`/cut-articles?${qs}`, 30_000);
  }
  return { total: Number(r.total) || (r.rows ?? []).length, rows: r.rows ?? [] };
}

export type HoldLine = { article: string; plate: string; parts: number; areaMm2: number };
export type Hold = {
  orderId: string; status: string; expiresAt: string | null; secondsLeft: number; expired: boolean;
  lines: HoldLine[]; totalParts: number; customer: string | null; source: string | null;
};
export type Holds = { orders: Hold[] };

export async function holds(): Promise<Holds> {
  const r = await gateway<{ orders?: Hold[] }>("/reservations", 30_000);
  return { orders: r.orders ?? [] };
}

/* ── status: the four questions worth asking about the chain ─────────────────── */

type RawHealth = {
  ledger?: { counts?: Record<string, number> };
  shelfAge?: Record<string, unknown>;
  guard?: Record<string, unknown>;
  promiseSweep?: Record<string, unknown>;
  erpRefs?: Record<string, unknown>;
  deliveredCuts?: Record<string, unknown>;
  areaHolds?: Record<string, unknown>;
};
type RawHomag = {
  configured?: boolean; running?: boolean; runs?: number; lastAt?: string | number | null;
  boardTypes?: number; articles?: number; feedDown?: boolean; feedDownReason?: string | null;
  feedFrozen?: boolean; frozenReason?: string | null; inventoryChangedAt?: string | null;
  idleWorkingHours?: number; cutDone?: Record<string, unknown> | null;
};
type RawHeartbeat = { reporting?: boolean; verdict?: string | null; hosts?: unknown[] };

export type Status = {
  setting: GatewaySetting;
  isAdmin: boolean;
  feed: {
    configured: boolean; down: boolean; downReason: string | null;
    frozen: boolean; frozenReason: string | null;
    boardTypes: number; inventoryChangedAt: string | null; idleWorkingHours: number; runs: number;
  };
  /** how old the shelf is by the File Agent's OWN write stamps — see homag-client.shelfAgeState */
  shelf: Record<string, unknown>;
  heartbeat: { reporting: boolean; verdict: string | null; hosts: number };
  cutDone: Record<string, unknown> | null;
  guard: Record<string, unknown>;
  promiseSweep: Record<string, unknown>;
  erpRefs: Record<string, unknown>;
  deliveredCuts: Record<string, unknown>;
  areaHolds: Record<string, unknown>;
  ledger: Record<string, number>;
};

export async function status(setting: GatewaySetting, isAdmin: boolean): Promise<Status> {
  const [h, m, hb] = await Promise.all([
    gateway<RawHealth>("/health"),
    gateway<RawHomag>("/homag/status"),
    gateway<RawHeartbeat>("/heartbeat").catch(() => ({}) as RawHeartbeat),
  ]);
  return {
    setting,
    isAdmin,
    feed: {
      configured: !!m.configured,
      down: !!m.feedDown,
      downReason: m.feedDownReason ?? null,
      frozen: !!m.feedFrozen,
      frozenReason: m.frozenReason ?? null,
      boardTypes: Number(m.boardTypes) || 0,
      inventoryChangedAt: m.inventoryChangedAt ?? null,
      idleWorkingHours: Number(m.idleWorkingHours) || 0,
      runs: Number(m.runs) || 0,
    },
    shelf: h.shelfAge ?? {},
    heartbeat: { reporting: !!hb.reporting, verdict: hb.verdict ?? null, hosts: (hb.hosts ?? []).length },
    cutDone: m.cutDone ?? null,
    guard: h.guard ?? {},
    promiseSweep: h.promiseSweep ?? {},
    erpRefs: h.erpRefs ?? {},
    deliveredCuts: h.deliveredCuts ?? {},
    areaHolds: h.areaHolds ?? {},
    ledger: h.ledger?.counts ?? {},
  };
}
