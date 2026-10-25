// OWNER REDIRECTION - retired 25.10.2026 (SARCLA: "that page should not exist"; "the override on the map is the
// redirection, nothing more"). Its two rules live on as Map assignment overrides (mapAssign/fixes.ts
// "2026-10-25-redirections-on-the-map": France -> Jeremy Borey, Sandra Kuridza -> James Koeremez). Here every rule is
// switched off and the empty set published, so the HubSpot app function finds no rule and changes nobody. Run once by
// the Map assignment engine right after that fix reached the saved rules; a failed publish is tried again next run.

import { kvGet, kvSet } from "@/lib/db/init";
import { listRules, saveRules, type StoredRule } from "./store";
import { publishRules, underPublishLock } from "./hubspot";
import type { Rule } from "./rules";

const KV_RETIRED = "ownerRules:retired20261025";

const bare = (r: StoredRule): Rule => {
  const { updatedAt, updatedBy, ...rule } = r;
  void updatedAt; void updatedBy;
  return rule as Rule;
};

/** Every rule off + published empty, once - the published note, or null when it was done before. Throws on a failed publish. */
export async function retireOwnerRedirection(by: string): Promise<string | null> {
  if (await kvGet<boolean>(KV_RETIRED)) return null;
  const res = await underPublishLock(async () => {
    const next = (await listRules()).map(bare).map((x) => ({ ...x, enabled: false }));
    await saveRules(next, by);
    return publishRules(next, by);
  });
  if (!res.ok) throw new Error(res.error);
  await kvSet(KV_RETIRED, true);
  return res.note;
}
