// OTD Reports > GLC: what DirectCut did with an order - a leftover off the shelf, or cut on the saw (C2S) - from the
// DirectCut middleware's pipeline (the same answer the hub's DirectCut page reads, lib/directcut). SARCLA 10.11.2026: "GLC
// show more KPI as your leftover and C2S". Kept, so a morning when the middleware does not answer keeps the last orders known.

import { kvGet, kvSet } from "@/lib/db/init";
import { gateway } from "@/lib/directcut/gateway";
import type { RawPipeline } from "@/lib/directcut/board";
import { kindsOf, mainOrder } from "./otdRules";

const KV_DC = "otd:directcut";
type Kept = { at: string; kinds: Record<string, "L" | "C"> };

export async function otdDirectCutKinds(): Promise<{ glcOf: (order: string) => "L" | "C" | undefined; status: Record<string, unknown> | string }> {
  const kept = await kvGet<Kept>(KV_DC).catch(() => null);
  let kinds = kept?.kinds ?? {}, status: Record<string, unknown> | string;
  try {
    const fresh = kindsOf(await gateway<RawPipeline>("/admin/pipeline", 40_000));
    // the orders the pipeline no longer lists keep their kind
    kinds = { ...kinds, ...fresh };
    await kvSet(KV_DC, { at: new Date().toISOString(), kinds } satisfies Kept);
    const v = Object.values(kinds);
    status = { orders: v.length, leftover: v.filter((x) => x === "L").length, cut: v.filter((x) => x === "C").length, read: true };
  }
  catch (e) { status = `DirectCut not read: ${(e as Error)?.message ?? e} - the ${Object.keys(kinds).length} kept orders used`; }
  return { glcOf: (o) => kinds[mainOrder(o)], status };
}
