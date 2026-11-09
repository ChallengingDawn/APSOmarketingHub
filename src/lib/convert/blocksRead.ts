// APSOconvert > Problem pages > Blocks: what the hub can count for a block today. The newsletter band's goal is a
// sign-up: HubSpot's newsletter forms (one per language, found by their name) and their submissions in the period -
// the forms scope the 3D page reads its form with. The other blocks are counted by the views of the pages that show
// them (the page reads those from Problem pages' own figures) and, once the shop's gateway counts clicks, by the click
// map. Nothing here is guessed: a source that does not answer says so.
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { describeIntegrationError } from "@/lib/integrations/status";

export type Signups = { forms: { id: string; name: string; n: number; more: boolean }[]; total: number; error: string | null };

type FormList = { results?: { id: string; name?: string; archived?: boolean }[]; paging?: { next?: { after?: string } } };
type SubPage = { results?: { submittedAt: number }[]; paging?: { next?: { after?: string } } };

const MAX_PAGES = 20;

/** The newsletter forms' sign-ups between two Swiss days (inclusive), newest first until the first day is passed. */
export async function newsletterSignups(from: string, to: string, signal?: AbortSignal): Promise<Signups> {
  try {
    const forms: { id: string; name: string }[] = [];
    let after: string | undefined;
    for (let p = 0; p < 5; p++) {
      const r = await hubspotFetchJson<FormList>({ path: `/marketing/v3/forms?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`, signal });
      for (const f of r.results ?? []) if (!f.archived && /newsletter/i.test(f.name ?? "")) forms.push({ id: f.id, name: (f.name ?? "").slice(0, 120) });
      after = r.paging?.next?.after;
      if (!after) break;
    }
    const start = Date.parse(`${from}T00:00:00+01:00`), end = Date.parse(`${to}T23:59:59+01:00`);
    const out: Signups["forms"] = [];
    for (const f of forms.slice(0, 12)) {
      let n = 0, more = false, next: string | undefined, done = false;
      for (let p = 0; p < MAX_PAGES && !done; p++) {
        const r = await hubspotFetchJson<SubPage>({ path: `/form-integrations/v1/submissions/forms/${encodeURIComponent(f.id)}?limit=50${next ? `&after=${encodeURIComponent(next)}` : ""}`, signal });
        for (const s of r.results ?? []) {
          if (s.submittedAt < start) { done = true; break; }
          if (s.submittedAt <= end) n++;
        }
        next = r.paging?.next?.after;
        if (!next) done = true;
        else if (p === MAX_PAGES - 1) more = true;
      }
      out.push({ id: f.id, name: f.name, n, more });
    }
    out.sort((a, b) => b.n - a.n);
    return { forms: out, total: out.reduce((s, f) => s + f.n, 0), error: forms.length ? null : "HubSpot has no form named \"newsletter\"." };
  } catch (e) {
    return { forms: [], total: 0, error: describeIntegrationError(e).error };
  }
}
