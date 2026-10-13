// 3D FILES - the hub's one page on the 3D service (SARCLA, 13.10.2026: "only one page", with the
// form's submissions and the tickets' stages).
//
// The service itself stays on Railway, in the Pricing Hub backend: the shop's catalogue (/cad),
// the product-page button, the HubSpot card's check and the request form all need a public
// address, and the hub has none - its load balancer answers the A+P network only. So the hub
// READS: Railway for the catalogue and the AP-Link check, HubSpot for the form's submissions
// and the 3D-request tickets. Nothing here writes.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { gatewayUrl } from "./gateway";
import { pairTickets, type Submission, type TicketRow } from "./pair";

export type { Submission, TicketRow } from "./pair";

/** The 3D catalogue's "request a 3D model" form (Railway /3d-request forwards to it). */
export const FORM_ID = "019cc378-d47e-4bc2-b768-32429dbccfa1";
const SUB = "enquiry_sub_category___product_information___1";
/** An article AP-Link is known to hold a model for - the reachability probe. */
const PROBE = "1150040144";

export type ThreeD = {
  at: string;
  service: {
    catalogue: boolean;
    aplink: boolean | null;
    articles: number | null;
    categories: { name: string; count: number }[];
    error?: string;
  };
  submissions: Submission[];
  /** Why the form could not be read, when it could not - the rest of the page still shows. */
  submissionsError?: string;
  tickets: TicketRow[];
  catalogueUrl: string;
};

const CHANNEL: Record<string, string> = { FORM: "Form", EMAIL: "Email", CHAT: "Chat" };

async function railway<T>(path: string, timeoutMs: number): Promise<T> {
  const res = await fetch(`${await gatewayUrl()}${path}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`the 3D service answered ${res.status} on ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

/** One article on AP-Link: is there a 3D model, a drawing, a data sheet. */
export async function checkArticle(article: string): Promise<{ article: string; stp: boolean; pdf: boolean; tds: boolean }> {
  return railway(`/3d/check?article=${encodeURIComponent(article)}`, 40_000);
}

async function service(): Promise<ThreeD["service"]> {
  const [cats, probe] = await Promise.allSettled([
    railway<{ total?: number; categories?: { name: string; count: number }[] }>("/3d-cats", 15_000),
    checkArticle(PROBE),
  ]);
  const ok = cats.status === "fulfilled";
  return {
    catalogue: ok,
    aplink: probe.status === "fulfilled" ? probe.value.stp : false,
    articles: ok ? cats.value.total ?? null : null,
    categories: ok ? (cats.value.categories ?? []).map((c) => ({ name: c.name, count: c.count })) : [],
    ...(ok ? {} : { error: String((cats.reason as Error)?.message ?? cats.reason) }),
  };
}

type FormPage = { results?: { submittedAt: number; values?: { name: string; value: string; objectTypeId?: string }[] }[]; paging?: { next?: { after?: string } } };

async function formSubmissions(): Promise<Omit<Submission, "ticket">[]> {
  const out: Omit<Submission, "ticket">[] = [];
  let after: string | undefined;
  for (let page = 0; page < 40; page++) {
    const r = await hubspotFetchJson<FormPage>({
      path: `/form-integrations/v1/submissions/forms/${FORM_ID}?limit=50${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    for (const s of r.results ?? []) {
      const email = (s.values?.find((x) => x.name === "email")?.value ?? "").trim().toLowerCase();
      if (email.endsWith("@example.com")) continue; // the July build's test submissions
      const v = (name: string, type?: string) => s.values?.find((x) => x.name === name && (!type || !x.objectTypeId || x.objectTypeId === type))?.value ?? "";
      out.push({
        at: new Date(s.submittedAt).toISOString(),
        name: `${v("firstname")} ${v("lastname")}`.trim(),
        email: v("email").trim().toLowerCase(),
        company: v("name", "0-2"),
        articles: v("article"),
      });
    }
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

type Obj = { id: string; properties?: Record<string, string | null> };

/** Every 3D-request ticket (any channel), with its stage's name, and each one's contact email. */
async function requestTickets(): Promise<{ rows: TicketRow[]; emailsOf: Map<string, string[]> }> {
  const tickets: Obj[] = [];
  let after: string | undefined;
  do {
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/tickets/search", method: "POST", useTicketsToken: true,
      body: {
        filterGroups: [{ filters: [{ propertyName: SUB, operator: "EQ", value: "3D Model request" }] }],
        properties: ["createdate", "hs_pipeline", "hs_pipeline_stage", "source_type", "hs_is_closed", "enquiry_textbox___product_information"],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100, after,
      },
    });
    tickets.push(...(r.results ?? []));
    after = r.paging?.next?.after;
  } while (after && tickets.length < 5000);

  const pipes = await hubspotFetchJson<{ results?: { id: string; label: string; stages: { id: string; label: string }[] }[] }>({
    path: "/crm/v3/pipelines/tickets", useTicketsToken: true,
  });
  const stageName = new Map<string, string>();
  for (const p of pipes.results ?? []) for (const s of p.stages) stageName.set(`${p.id}/${s.id}`, `${p.label} › ${s.label}`);

  const rows: TicketRow[] = tickets.map((t) => {
    const p = t.properties ?? {};
    return {
      id: t.id,
      at: p.createdate ?? "",
      channel: CHANNEL[p.source_type ?? ""] ?? "Other",
      stage: stageName.get(`${p.hs_pipeline}/${p.hs_pipeline_stage}`) ?? (p.hs_pipeline_stage ?? "-"),
      closed: p.hs_is_closed === "true",
      // the form has no article field; its workflow copies "3D Model request — article(s): …" here
      articles: /article\(s\):\s*(.+)$/i.exec(p.enquiry_textbox___product_information ?? "")?.[1]?.trim() ?? "",
    };
  });

  // EVERY contact of each FORM ticket, to pair it with its submission (by email and time): the
  // submitter is not always the first - on Kevin Meili's ticket an A+P colleague came first, and
  // matching on the first contact left every row "no ticket found" (13.10.2026)
  const formIds = rows.filter((r) => r.channel === "Form").map((r) => r.id);
  const contactsOf = new Map<string, string[]>();
  for (let i = 0; i < formIds.length; i += 100) {
    const a = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: string | number }[] }[] }>({
      path: "/crm/v4/associations/tickets/contacts/batch/read", method: "POST",
      body: { inputs: formIds.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const x of a.results ?? []) {
      if (x.from?.id && x.to?.length) contactsOf.set(String(x.from.id), x.to.filter((t) => t.toObjectId != null).map((t) => String(t.toObjectId)));
    }
  }
  const cids = [...new Set([...contactsOf.values()].flat())];
  const mail = new Map<string, string>();
  for (let i = 0; i < cids.length; i += 100) {
    const c = await hubspotFetchJson<{ results?: Obj[] }>({
      path: "/crm/v3/objects/contacts/batch/read", method: "POST",
      body: { inputs: cids.slice(i, i + 100).map((id) => ({ id })), properties: ["email"] },
    });
    for (const x of c.results ?? []) if (x.properties?.email) mail.set(x.id, x.properties.email.trim().toLowerCase());
  }
  const emailsOf = new Map<string, string[]>();
  for (const [tid, ids] of contactsOf) emailsOf.set(tid, ids.map((id) => mail.get(id)).filter((e): e is string => !!e));
  return { rows, emailsOf };
}

export async function readThreeD(): Promise<ThreeD> {
  const [svc, tickets, subs] = await Promise.all([
    service(),
    requestTickets(),
    formSubmissions().then((s) => ({ s }), (e: unknown) => ({ error: String((e as Error)?.message ?? e) })),
  ]);
  return {
    at: new Date().toISOString(),
    service: svc,
    submissions: "s" in subs ? pairTickets(subs.s, tickets.rows, tickets.emailsOf) : [],
    ...("error" in subs ? { submissionsError: subs.error } : {}),
    tickets: tickets.rows,
    catalogueUrl: `${await gatewayUrl()}/cad`,
  };
}
