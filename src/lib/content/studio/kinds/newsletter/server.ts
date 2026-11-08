// NEWSLETTER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026).
//   AI      draft (the whole newsletter from the brief - in the words of our best ones), subjects (five subject + preheader
//           pairs), rewrite (one block as asked)
//   actions learn (what our last newsletters in HubSpot were and how they did - when the hub's HubSpot app may read
//           marketing e-mails; else our gold examples), hubspot (send the e-mail to HubSpot as a DRAFT - switched off
//           until SARCLA tests it: CONTENT_HUBSPOT_PUSH=on; a draft is never sent by the hub, a person schedules it)
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { readBrain } from "@/lib/brain";
import { s, type KindDef, type StudioCtx } from "../../contract";
import { asNewsletter, emptyNewsletter, newsletterText, renderEmail, PREHEADER_MAX, SUBJECT_MAX } from "./model";

const ctxText = (ctx: StudioCtx) => [
  `Project: ${ctx.projectTitle}`, `This newsletter: ${ctx.piece.title}`,
  ctx.brief.goal && `Goal: ${ctx.brief.goal}`, ctx.brief.audience && `Who it is for: ${ctx.brief.audience}`,
  ctx.brief.message && `Key message: ${ctx.brief.message}`, ctx.brief.keywords.length ? `Keywords: ${ctx.brief.keywords.join(", ")}` : "",
  `Language of the newsletter: ${ctx.piece.language ?? "EN"}`,
].filter(Boolean).join("\n");

const RULES = `You write e-mail newsletters for APSOparts (an online shop for technical parts: seals, O-rings, hoses, plastics, cut-to-size). Answer ONLY in the JSON schema given - the plain-text newsletter format rules ("Subject:" on line 1, sign-off) do not apply here: the fields are the format. Write in the newsletter's language. Subject under ${SUBJECT_MAX} characters, concrete, no "newsletter", no month name; preheader under ${PREHEADER_MAX} characters and never repeating the subject. Each story is news, not an announcement: one concrete detail that proves it is ours. Never a discount value, never invented figures, prices, customers or quotes. Button labels: two to four words, a verb first.`;

const str = (max: number) => ({ type: "string", description: `at most ${max} characters` });

export const newsletterKind: KindDef = {
  kind: "newsletter",
  channel: "newsletter",
  empty: (ctx) => emptyNewsletter(ctx.piece.language ?? "EN"),
  toText: newsletterText,
  tasks: {
    draft: {
      label: "Write it from the brief",
      system: `${RULES}\nWrite the whole newsletter: subject, preheader, a lead story with its eyebrow (two to four words), headline and two short paragraphs, two shorter stories of one paragraph each with a link label, and a closing call to action.`,
      user: (ctx, _doc, input) => [ctxText(ctx), s(input.request) && `What the person asks: ${s(input.request)}`,
        s(input.learned, 3000) && `What our last newsletters were (subject - opens - clicks):\n${s(input.learned, 3000)}`].filter(Boolean).join("\n\n"),
      schema: {
        type: "object", additionalProperties: false,
        required: ["subject", "preheader", "eyebrow", "headline", "lead", "button", "stories", "cta", "ctaButton"],
        properties: {
          subject: str(SUBJECT_MAX), preheader: str(PREHEADER_MAX), eyebrow: str(30), headline: str(70),
          lead: { type: "string", description: "two short paragraphs separated by a blank line; **bold** allowed" },
          button: str(28),
          stories: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "text", "link"], properties: { title: str(70), text: { type: "string" }, link: str(28) } } },
          cta: str(90), ctaButton: str(28),
        },
      },
      maxTokens: 3000,
      clean: (raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const stories = Array.isArray(r.stories) ? r.stories.slice(0, 3).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { title: s(o.title, 120), text: s(o.text, 1500), link: s(o.link, 40) }; }) : [];
        return {
          subject: s(r.subject, 120), preheader: s(r.preheader, 160), eyebrow: s(r.eyebrow, 60), headline: s(r.headline, 140),
          lead: s(r.lead, 2500), button: s(r.button, 40), stories, cta: s(r.cta, 200), ctaButton: s(r.ctaButton, 40),
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
    rewrite: {
      label: "Rewrite a block",
      system: `${RULES}\nRewrite the one block you are given as the person asks; keep its facts, its language and its links. Return the same fields.`,
      user: (ctx, doc, input) => {
        const b = asNewsletter(doc).blocks.find((x) => x.id === s(input.blockId));
        return `${ctxText(ctx)}\n\nThe block (${b?.kind ?? "?"}): ${JSON.stringify(b ?? {})}\n\nThe person asks: ${s(input.request) || "make it shorter and more concrete"}`;
      },
      schema: {
        type: "object", additionalProperties: false, required: ["title", "text", "button"],
        properties: { title: { type: "string", description: "the headline or title, \"\" when the block has none" }, text: { type: "string" }, button: { type: "string", description: "the button or link label, \"\" when none" } },
      },
      clean: (raw) => { const r = (raw ?? {}) as Record<string, unknown>; return { title: s(r.title, 200), text: s(r.text, 3000), button: s(r.button, 40) }; },
    },
  },
  actions: {
    /** Our last newsletters in HubSpot, when the app may read them; otherwise the gold examples the brain keeps. */
    learn: async () => {
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
    /** The e-mail as HTML, built here - the browser never sends it (the 8 KB limit). */
    html: async (_ctx, doc) => ({ html: renderEmail(doc) }),
    /** A DRAFT in HubSpot - never sent by the hub. Off until SARCLA has tested it with the app's e-mail scope. */
    hubspot: async (ctx, doc, input) => {
      if (process.env.CONTENT_HUBSPOT_PUSH !== "on") {
        return { done: false, why: "Sending drafts to HubSpot is not switched on yet. Download the HTML and paste it into a HubSpot e-mail (custom HTML), or ask an admin to switch it on." };
      }
      if (input.confirm !== true) return { done: false, why: "Confirm first." };
      const d = asNewsletter(doc);
      const made = await hubspotFetchJson<{ id?: string }>({
        path: "/marketing/v3/emails", method: "POST",
        body: { name: `${ctx.projectTitle} - ${ctx.piece.title}`.slice(0, 200), subject: d.subject, language: d.language.toLowerCase(), subcategory: "batch" },
      });
      return { done: !!made.id, emailId: made.id ?? null, url: made.id ? `https://app-eu1.hubspot.com/email/26492587/edit/${made.id}/content` : null,
        note: "Made as a draft with its subject. Its body is pasted from the hub's HTML (Download HTML) until HubSpot's template is connected." };
    },
  },
};
