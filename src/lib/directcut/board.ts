// DIRECTCUT - the slim projection of the middleware's pipeline answer.
//
// THIS FILE IMPORTS NOTHING. It is the one piece of the DirectCut page with real logic in it, so it is kept
// pure and tested directly (tests/directcut-slim.test.ts) - the same reason directup/events.ts is pure.
//
// WHY A PROJECTION AT ALL. /admin/pipeline answers 967 KB (measured 16.10.2026): 852 cut-done cards are
// 531 KB of history nobody reads on first paint, and the per-plate rows inside stockImpact are another
// 152 KB. The hub runs in Frankfurt and the gateway in Zurich, so shipping all of that on every board load
// is the one real cost of reading this tool from the hub. Cutting it here, on the server, takes it to 86 KB
// with every figure the page shows still present.

/* ── what the middleware answers, in the shapes this page reads ─────────────── */

export const STAGES = ["reserved", "lapsed", "ordered", "to-cut", "cut-done", "closed"] as const;
export type Stage = (typeof STAGES)[number];

/** One pipeline card, as cut-ledger.card() builds it. Only the fields this page shows. */
type RawLine = {
  key: string; basis?: string | null; basisName?: string | null; cutArticle?: string | null;
  l?: number; w?: number; qty?: number; heldQty?: number; producedQty?: number;
  stage: Stage; orderNo?: string | null; erpNo?: string | null; date?: string | null;
  sawNeeded?: boolean | null; kind?: string | null; customer?: string | null;
  enteredStageAt?: string | null; createdAt?: string | null; originBackend?: boolean;
};
type RawStock = {
  basis: string; name?: string; thickness?: number | null; known?: boolean;
  /** the Lagerplatz of each plate, stamped by the middleware from HOMAG's inventory */
  locations?: string[];
  physicalPieces?: number; physical?: number; shownNet?: number;
  heldParts?: number; pinnedParts?: number; producedParts?: number;
  plates?: unknown[];
};
export type RawPipeline = { at: string; counts: Record<string, number>; stages: Record<string, RawLine[]>;
  stockImpact: RawStock[]; erpRefs?: { known?: number; withOrderNo?: number } };

/* ── the slim projection ────────────────────────────────────────────────────────
   WHY THIS EXISTS. /admin/pipeline is 967 KB: 852 cut-done cards are 531 KB of
   history nobody needs on first paint, and the per-plate rows inside stockImpact
   are another 152 KB. Shipping that from Zurich to Frankfurt and on to a browser
   on every board load is the one real cost of putting this page in the hub, so
   the projection happens HERE, on the server. Measured 16.10: 967 KB -> 86 KB,
   91% smaller, with every figure the page shows still present. */

/* HOW MANY FINISHED LINES TRAVEL. A cap, because the whole history is 531 KB of the gateway's 967 KB
   answer, but a cap the reader can lift: SARCLA, 17.10.2026 - "you are only showing 100 more recent but
   you should allow to see more". The page asks for more when it wants more. */
/* THE MOVES A PERSON MAY MAKE BY HAND, mirroring the middleware's own MANUAL_FROM. They live HERE, in the
   module that imports nothing, because the Kanban is a client component: importing them from gateway.ts
   pulled kvGet -> pg -> 'dns'/'net' into the browser bundle and the build refused. A rule the UI needs to
   draw a button must not sit behind a database client. */
export const MANUAL_FROM: Record<string, string[]> = {
  "to-cut": ["ordered"],
  "cut-done": ["ordered", "to-cut"],
  closed: ["reserved", "lapsed", "ordered", "to-cut", "cut-done"],
};
export const canMove = (from: string, to: string) => (MANUAL_FROM[to] ?? []).includes(from);

const DONE_DEFAULT = 100;
const DONE_MAX = 2000;
const OPEN: Stage[] = ["reserved", "ordered", "to-cut"];

export type Line = {
  key: string; stage: Stage; basis: string | null; name: string;
  /** the 8001 number the shop ordered - the only identifier a "by number only" line has */
  cutArticle: string | null;
  l: number; w: number; qty: number; held: number; produced: number;
  orderNo: string | null; erpNo: string | null; date: string | null;
  sawNeeded: boolean | null; kind: string | null; customer: string | null;
  at: string | null; fromShop: boolean;
};
export type StockRow = {
  basis: string; name: string; thickness: number | null; known: boolean;
  plates: number; physical: number; offered: number; held: number; pinned: number; produced: number;
  /** which shelves this article's plates are on — one article's offcuts can sit on several */
  locations: string[];
};
export type Board = {
  at: string;
  counts: Record<string, number>;
  /* HOW MANY LINES CARRY THEIR A-NUMBER. It comes from the pipeline view, not from health: health's
     erpRefs reports the SWEEPER (runs, asked, written), which is a different question. Reading the
     sweeper's figures as coverage made the page say "0" while 1094 of 1095 lines in fact had one. */
  erpRefs: { known: number; withOrderNo: number };
  open: Line[];
  done: Line[];
  doneTotal: number;
  stock: StockRow[];
};

const line = (r: RawLine): Line => ({
  key: String(r.key),
  cutArticle: r.cutArticle ?? null,
  stage: r.stage,
  basis: r.basis ?? null,
  name: r.basisName ?? "",
  l: Number(r.l) || 0,
  w: Number(r.w) || 0,
  qty: Number(r.qty) || 0,
  held: Number(r.heldQty) || 0,
  produced: Number(r.producedQty) || 0,
  orderNo: r.orderNo ?? null,
  erpNo: r.erpNo ?? null,
  date: r.date ?? null,
  sawNeeded: r.sawNeeded ?? null,
  kind: r.kind ?? null,
  customer: r.customer ?? null,
  at: r.enteredStageAt ?? r.createdAt ?? null,
  // a line the widget booked, as against one the ERP/Magento feed brought in
  fromShop: !r.originBackend,
});

export function slim(p: RawPipeline, doneShown = DONE_DEFAULT): Board {
  const cap = Math.max(1, Math.min(DONE_MAX, Math.floor(doneShown) || DONE_DEFAULT));
  const stages = p.stages ?? {};
  const open = OPEN.flatMap((s) => (stages[s] ?? []).map(line));
  const doneAll = stages["cut-done"] ?? [];
  return {
    at: p.at,
    counts: p.counts ?? {},
    erpRefs: { known: Number(p.erpRefs?.known) || 0, withOrderNo: Number(p.erpRefs?.withOrderNo) || 0 },
    open,
    // newest first: the pipeline sorts each stage oldest-first by enteredStageAt
    done: [...doneAll].reverse().slice(0, cap).map(line),
    doneTotal: doneAll.length,
    stock: (p.stockImpact ?? []).map((a) => ({
      basis: a.basis,
      name: a.name ?? "",
      thickness: a.thickness ?? null,
      known: !!a.known,
      plates: (a.plates ?? []).length,
      physical: Number(a.physical) || 0,
      offered: Number(a.shownNet) || 0,
      held: Number(a.heldParts) || 0,
      pinned: Number(a.pinnedParts) || 0,
      produced: Number(a.producedParts) || 0,
      locations: Array.isArray(a.locations) ? a.locations.filter(Boolean).map(String) : [],
    })),
  };
}
