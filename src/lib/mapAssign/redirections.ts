// MAP ASSIGNMENT - answering an Owner redirection rule that works against the map (SARCLA 20.10.2026: "if these rules
// are contrary to assignment we need to have an alert here that we accept or decline", per rule). The conflicts are
// counted in engine.ts (conflicts()); the answer:
//   "map"   accept - the map wins: the rule is switched off in Owner redirection, saved and published to HubSpot the
//           way its own board does it, and the answer kept
//   "rule"  decline - the rule wins: the answer kept; the engine then gives every company the rule matches (first
//           match, as Owner redirection runs them) to the rule's person and the map leaves them alone
//   null    forget the answer
// An answer is tied to the rule as it was: edit the rule and the alert comes back. Every answer decides the stored
// companies again at once (redecideAll), so the page shows the new picture without waiting for a scan.

import { query } from "@/lib/db/client";
import { listRules, saveRules as saveOwnerRules, type StoredRule } from "@/lib/ownerRules/store";
import { publishRules, underPublishLock } from "@/lib/ownerRules/hubspot";
import { ruleSetProblems, toPub, type Rule } from "@/lib/ownerRules/rules";
import { redecideAll, saveRedirAnswer } from "./engine";

const bare = (r: StoredRule): Rule => {
  const { updatedAt, updatedBy, ...rule } = r;
  void updatedAt; void updatedBy;
  return rule as Rule;
};

export type Answered = { ok: true; note: string; redecided: number } | { ok: false; error: string; status: number };

export async function answerConflict(ruleId: string, decision: "map" | "rule" | null, by: string, userId: number): Promise<Answered> {
  const rule = (await listRules()).find((x) => x.id === ruleId);
  if (!rule) return { ok: false, error: "There is no such Owner redirection rule (any more).", status: 404 };
  let note = decision === "rule" ? "Kept: the rule wins, the map leaves its companies alone." : decision === null ? "Answer forgotten." : "";
  if (decision === "map") {
    if (!rule.enabled) note = "The rule is off already.";
    else {
      const res = await underPublishLock(async () => {
        const next = (await listRules()).map(bare).map((x) => (x.id === ruleId ? { ...x, enabled: false } : x));
        const problems = ruleSetProblems(next);
        if (problems.errors.length) return { ok: false as const, error: problems.errors.join(" ") };
        await saveOwnerRules(next, by);
        await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`, [
          String(userId), "owner_rules.save", JSON.stringify({ what: "map assignment: the map wins, rule off", rule: ruleId }),
        ]).catch(() => {});
        const pub = await publishRules(next, by);
        return { ok: true as const, note: pub.ok ? `The map wins: the rule is off and published. ${pub.note}` : `The rule is off in the hub, but NOT published to HubSpot - HubSpot keeps running the rules it had. ${pub.error}` };
      });
      if (!res.ok) return { ok: false, error: res.error, status: 400 };
      note = res.note;
    }
  }
  await saveRedirAnswer(toPub(rule), decision, by);
  return { ok: true, note, redecided: await redecideAll() };
}
