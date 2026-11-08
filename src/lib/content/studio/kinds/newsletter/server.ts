// NEWSLETTER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026; Content v2 the same day).
//   AI      draft (the whole newsletter from the brief - in the words of our best ones - with an idea for each picture),
//           subjects (five subject + preheader pairs), edit (the words of every block, or of one, changed as asked:
//           rewritten, shorter, more personal, translated - the one task behind the assistant's buttons and free ask)
//   actions learn (what our last newsletters in HubSpot were and how they did - when the hub's HubSpot app may read
//           marketing e-mails; else our gold examples), html (the e-mail, its hub pictures with the hub's full address),
//           hubspot (send the e-mail to HubSpot as a DRAFT - switched off until SARCLA tests it: CONTENT_HUBSPOT_PUSH=on;
//           a draft is never sent by the hub, a person schedules it)
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { kvGet, kvSet } from "@/lib/db/init";
import { readBrain } from "@/lib/brain";
import { s, type KindDef, type StudioCtx } from "../../contract";
import { asNewsletter, editable, emptyNewsletter, newBlock, newsletterText, renderEmail, textFields, PREHEADER_MAX, SUBJECT_MAX } from "./model";
import { blocksFrom, digestOf, draftInHubspot, emailParts, ourEmails } from "./hubspotEmails";

/** Drafts to HubSpot: an admin switches them on in the studio (kv), or the hub's CONTENT_HUBSPOT_PUSH=on - no server change. */
const PUSH_KEY = "content:hubspot_push";
async function pushOn(): Promise<boolean> {
  if (process.env.CONTENT_HUBSPOT_PUSH === "on") return true;
  return (await kvGet<{ on?: boolean }>(PUSH_KEY).catch(() => undefined))?.on === true;
}

const LANGUAGE: Record<string, string> = { DE: "German", FR: "French", IT: "Italian", EN: "English", NL: "Dutch", PL: "Polish" };

const ctxText = (ctx: StudioCtx, lang?: string) => [
  `Project: ${ctx.projectTitle}`, `This newsletter: ${ctx.piece.title}`,
  ctx.brief.goal && `Goal: ${ctx.brief.goal}`, ctx.brief.audience && `Who it is for: ${ctx.brief.audience}`,
  ctx.brief.message && `Key message: ${ctx.brief.message}`, ctx.brief.keywords.length ? `Keywords: ${ctx.brief.keywords.join(", ")}` : "",
  `Language of the newsletter: ${LANGUAGE[(lang ?? ctx.piece.language ?? "EN").toUpperCase()] ?? lang ?? "English"}`,
].filter(Boolean).join("\n");

const RULES = `You write e-mail newsletters for APSOparts (an online shop for technical parts: seals, O-rings, hoses, plastics, cut-to-size). Answer ONLY in the JSON schema given - the plain-text newsletter format rules ("Subject:" on line 1, sign-off) do not apply here: the fields are the format. Write in the newsletter's language. Subject under ${SUBJECT_MAX} characters, concrete, no "newsletter", no month name; preheader under ${PREHEADER_MAX} characters and never repeating the subject. Each story is news, not an announcement: one concrete detail that proves it is ours. Never a discount value, never invented figures, prices, customers, certificates or quotes; never name Chemours. Wherever chemical compatibility or resistance comes up, add the line "for information only, no guarantee, no liability" in the newsletter's language. Button labels: two to four words, a verb first.`;

const PICTURE = "what a photo for it would show, in English, concrete: the part in use, hands and tools, the plant or workshop, natural light; no lettering, never a product on white";

const str = (max: number) => ({ type: "string", description: `at most ${max} characters` });

export const newsletterKind: KindDef = {
  kind: "newsletter",
  channel: "newsletter",
  empty: (ctx) => emptyNewsletter(ctx.piece.language ?? "EN"),
  toText: newsletterText,
  tasks: {
    draft: {
      label: "Write it from the brief",
      system: `${RULES}\nWrite the whole newsletter: subject, preheader, a lead story with its eyebrow (two to four words), headline and two short paragraphs, as many shorter stories as asked (one paragraph each, with a link label), an intro or closing line for a text block, and a closing call to action. Give the lead story and each story an idea for its photo.`,
      user: (ctx, doc, input) => {
        const d = asNewsletter(doc);
        const n = Math.max(1, Math.min(4, d.blocks.filter((b) => b.kind === "article").length || 2));
        return [ctxText(ctx), `Stories to write: ${n}`, s(input.request) && `What the person asks: ${s(input.request)}`,
          s(input.learned, 3000) && `What our last newsletters were (subject - opens - clicks):\n${s(input.learned, 3000)}`,
          newsletterText(d).replace(/^Subject: \nPreheader: \n?/, "").trim() ? `The newsletter now (keep what still fits):\n${newsletterText(d).slice(0, 4000)}` : ""].filter(Boolean).join("\n\n");
      },
      schema: {
        type: "object", additionalProperties: false,
        required: ["subject", "preheader", "eyebrow", "headline", "lead", "button", "picture", "stories", "intro", "cta", "ctaButton"],
        properties: {
          subject: str(SUBJECT_MAX), preheader: str(PREHEADER_MAX), eyebrow: str(30), headline: str(70),
          lead: { type: "string", description: "two short paragraphs separated by a blank line; **bold** allowed" },
          button: str(28),
          picture: { type: "string", description: `the lead story's photo: ${PICTURE}` },
          stories: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "text", "link", "picture"], properties: { title: str(70), text: { type: "string" }, link: str(28), picture: { type: "string", description: PICTURE } } } },
          intro: { type: "string", description: "one or two sentences for a text block: what this letter brings, or a practical suggestion to close" },
          cta: str(90), ctaButton: str(28),
        },
      },
      maxTokens: 4000,
      clean: (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const stories = Array.isArray(r.stories) ? r.stories.slice(0, 4).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { title: s(o.title, 120), text: s(o.text, 1500), link: s(o.link, 40), picture: s(o.picture, 600) }; }) : [];
        return {
          subject: s(r.subject, 120), preheader: s(r.preheader, 160), eyebrow: s(r.eyebrow, 60), headline: s(r.headline, 140),
          lead: s(r.lead, 2500), button: s(r.button, 40), picture: s(r.picture, 600), stories, intro: s(r.intro, 600), cta: s(r.cta, 200), ctaButton: s(r.ctaButton, 40),
        };
      },
    },
    subjects: {
      label: "Five subject lines",
      system: `${RULES}\nPropose five different subject lines, each with its preheader, and one short reason each (why it would be opened). Vary the angle: the benefit, the news, a question, the detail, the customer's job.`,
      user: (ctx, doc) => `${ctxText(ctx)}\n\nThe newsletter now:\n${newsletterText(doc).slice(0, 4000)}`,
      schema: {
        type: "object", additionalProperties: false, required: ["options"],
        properties: { options: { type: "array", items: { type: "object", additionalProperties: false, required: ["subject", "preheader", "why"], properties: { subject: str(SUBJECT_MAX), preheader: str(PREHEADER_MAX), why: str(120) } } } },
      },
      clean: (raw) => {
        const o = ((raw ?? {}) as { options?: unknown[] }).options ?? [];
        return o.slice(0, 6).map((x) => { const r = (x ?? {}) as Record<string, unknown>; return { subject: s(r.subject, 120), preheader: s(r.preheader, 160), why: s(r.why, 200) }; });
      },
    },
    edit: {
      label: "Change the words",
      system: `${RULES}
You are given the newsletter's words as blocks of named fields (and its subject and preheader). Change them as the person asks
and answer with ONLY the fields you changed, under their block's id and their own names - never a new block, never a new
field name. Keep facts, figures, links and the language unless asked to translate; when translating, translate every field
given (subject and preheader too). "button" and "link" are button labels; "imageAlt" says what a picture shows; "itemNBig" is
a fact's figure (keep the figure, translate only its unit words).`,
      user: (ctx, doc, input) => {
        const lang = s(input.language, 4).toUpperCase();
        const words = editable(doc, s(input.blockId, 40) || undefined);
        const ask = s(input.request, 2000) || "Make it shorter and more concrete.";
        return [ctxText(ctx), lang ? `Translate into: ${LANGUAGE[lang] ?? lang}` : "", `What the person asks: ${ask}`,
          `The words now:\n${JSON.stringify(words).slice(0, 14_000)}`].filter(Boolean).join("\n\n");
      },
      schema: {
        type: "object", additionalProperties: false, required: ["subject", "preheader", "blocks", "note"],
        properties: {
          subject: { type: "string", description: "the new subject, or \"\" when it stays" },
          preheader: { type: "string", description: "the new preheader, or \"\" when it stays" },
          blocks: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["id", "fields"],
              properties: {
                id: { type: "string" },
                fields: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "value"], properties: { name: { type: "string" }, value: { type: "string" } } } },
              },
            },
          },
          note: { type: "string", description: "one short line IN ENGLISH (the studio's language, whatever the newsletter's): what you changed" },
        },
      },
      maxTokens: 6000,
      clean: (raw, doc, _ctx, input) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const d = asNewsletter(doc);
        const only = s(input.blockId, 40);
        const known = new Map(d.blocks.filter((b) => !only || b.id === only).map((b) => [b.id, new Set(textFields(b).map((f) => f.name))]));
        const blocks = (Array.isArray(r.blocks) ? r.blocks : []).map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          const names = known.get(s(o.id, 40));
          if (!names) return null;
          const fields = (Array.isArray(o.fields) ? o.fields : []).map((f) => { const y = (f ?? {}) as Record<string, unknown>; return { name: s(y.name, 40), value: s(y.value, 3000) }; })
            .filter((f) => names.has(f.name));
          return fields.length ? { id: s(o.id, 40), fields } : null;
        }).filter((x): x is { id: string; fields: { name: string; value: string }[] } => !!x);
        return { subject: only ? "" : s(r.subject, 120), preheader: only ? "" : s(r.preheader, 160), blocks, note: s(r.note, 200) };
      },
    },
  },
  actions: {
    /** Our e-mails in HubSpot, newest first, one group per campaign across its languages - to look at and start from. */
    ourEmails: async () => {
      try {
        return { ok: true, groups: (await ourEmails()).slice(0, 80) };
      } catch (e) {
        return { ok: false, why: e instanceof Error ? e.message.slice(0, 240) : "HubSpot did not answer", groups: [] };
      }
    },
    /** One of our e-mails as this studio's blocks - its subject, preheader, stories, pictures and buttons. */
    fromEmail: async (_ctx, _doc, input) => {
      const id = s(input.emailId, 24);
      if (!/^\d+$/.test(id)) return { ok: false, why: "Which e-mail?" };
      const e = await emailParts(id);
      const all = await ourEmails().catch(() => [] as Awaited<ReturnType<typeof ourEmails>>);
      const v = all.flatMap((g) => g.variants).find((x) => x.id === id);
      // as it went out: our logo on top when it had it (Logo2 - the header block); a campaign's own header picture,
      // which carries the logo in it, stays its lead story's picture
      const blocks = blocksFrom(e.parts, e.subject);
      return {
        // HubSpot's footer is the e-mail's frame, not one of its parts: ours closes it (the unsubscribe link, the address)
        ok: true, subject: e.subject, preheader: e.preheader, language: e.language, blocks: [...blocks, newBlock("footer", undefined, e.language)],
        startedFrom: { emailId: e.id, subject: e.subject, language: e.language, date: v?.date ?? "" },
      };
    },
    /** Our last newsletters in HubSpot, when the app may read them; otherwise the gold examples the brain keeps.
     *  With `emailIds`, the e-mails picked: their words in short, for the assistant to write like them. */
    learn: async (_ctx, _doc, input) => {
      const ids = (Array.isArray(input.emailIds) ? input.emailIds : []).map((x) => String(x)).filter((x) => /^\d+$/.test(x)).slice(0, 4);
      if (ids.length) {
        const all = await ourEmails().catch(() => [] as Awaited<ReturnType<typeof ourEmails>>);
        const variants = all.flatMap((g) => g.variants);
        const read = await Promise.all(ids.map((id) => emailParts(id).catch(() => null)));
        const pct = (n: number | null) => (n === null ? "not tracked" : `${Math.round(n * 100)}%`);
        const newsletters = read.filter((x): x is NonNullable<typeof x> => !!x).map((e) => {
          const v = variants.find((x) => x.id === e.id);
          return { subject: e.subject, date: v?.date ?? "", opens: pct(v?.openRate ?? null), clicks: pct(v?.clickRate ?? null), words: digestOf(e, 700) };
        });
        return { from: "hubspot", picked: true, newsletters };
      }
      try {
        const j = await hubspotFetchJson<{ results?: { name?: string; subject?: string; publishDate?: string; stats?: { counters?: { open?: number; click?: number; delivered?: number } } }[] }>({
          path: "/marketing/v3/emails?limit=30&includeStats=true&sort=-publishDate",
        });
        const sent = (j.results ?? []).filter((e) => e.publishDate && e.subject).slice(0, 15).map((e) => {
          const c = e.stats?.counters ?? {};
          const rate = (n?: number) => (c.delivered ? `${Math.round(((n ?? 0) / c.delivered) * 100)}%` : "?");
          return { subject: e.subject!, date: e.publishDate!.slice(0, 10), opens: rate(c.open), clicks: rate(c.click) };
        });
        return { from: "hubspot", newsletters: sent };
      } catch (e) {
        const brain = await readBrain();
        const ex = (brain as unknown as { goldExamples?: { newsletterExamples?: string[] } }).goldExamples?.newsletterExamples ?? [];
        return { from: "examples", why: e instanceof Error ? e.message.slice(0, 200) : "HubSpot did not answer", examples: ex.slice(0, 2).map((x) => x.slice(0, 1200)) };
      }
    },
    /** The e-mail as HTML, built here - the browser never sends it (the 8 KB limit). Pictures kept in the hub carry the
     *  hub's full address: HubSpot can only show them once that address is public (or the pictures are in HubSpot's files). */
    html: async (_ctx, doc) => ({ html: renderEmail(doc, { origin: (process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com").replace(/\/+$/, "") }) }),
    /** A DRAFT in HubSpot - never sent by the hub. Made from the e-mail the newsletter was started from (its look, footer,
     *  subscription settings) with what was changed here; a person checks it and schedules it in HubSpot.
     *  Switched on by CONTENT_HUBSPOT_PUSH=on (SARCLA's "go" 08.11.2026 for the test). */
    /** Whether drafts go to HubSpot - and, for an admin, the switch. */
    pushState: async (ctx) => ({ on: await pushOn(), byEnv: process.env.CONTENT_HUBSPOT_PUSH === "on", admin: ctx.me.admin }),
    pushSwitch: async (ctx, _doc, input) => {
      if (!ctx.me.admin) return { ok: false, why: "Only an admin switches HubSpot drafts on or off." };
      await kvSet(PUSH_KEY, { on: input.on === true, by: ctx.me.username, at: new Date().toISOString() });
      return { ok: true, on: await pushOn() };
    },
    hubspot: async (ctx, doc, input) => {
      if (!(await pushOn())) {
        return { done: false, why: "Sending drafts to HubSpot is not switched on yet. Download the HTML and paste it into a HubSpot e-mail (custom HTML), or ask an admin to switch it on (here, under Send it out)." };
      }
      if (input.confirm !== true) return { done: false, why: "Confirm first." };
      const d = asNewsletter(doc);
      if (!d.startedFrom?.emailId) {
        return { done: false, why: "Start the newsletter from one of our e-mails (Our e-mails) - the HubSpot draft copies its look, footer and subscription settings." };
      }
      const r = await draftInHubspot(d, `${ctx.projectTitle} - ${ctx.piece.title}`.slice(0, 200));
      return {
        done: true, emailId: r.id, url: r.url,
        note: [r.changed.length ? `In the draft: ${r.changed.length} change${r.changed.length === 1 ? "" : "s"} from here.` : "The draft is the original with this subject and preheader.", ...r.notes].join(" "),
      };
    },
  },
};
