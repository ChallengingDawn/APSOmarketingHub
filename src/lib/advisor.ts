/**
 * Advisor — the priority engine behind the Overview hero.
 *
 * This module is PURE and DETERMINISTIC on purpose. The hero has to tell the
 * marketer what to work on the instant the page paints, and it has to be right
 * every time; an LLM is neither fast enough nor reproducible enough for that
 * job. Claude is used only for the free-text "ask the advisor" box
 * (/api/advisor), and even there it is handed the output of this file as its
 * only source of numbers.
 *
 * HARD RULE — every recommendation carries the concrete figure it was derived
 * from in `evidence`. If a signal is missing we do not guess and we do not
 * substitute a plausible number: we either drop the recommendation or emit an
 * explicit "this source could not be read" recommendation. A missing source is
 * a fact worth surfacing; an invented number is a defect.
 */

export type Severity = "critical" | "attention" | "opportunity";

export type AdvisorAction = { label: string; href: string };

export type Recommendation = {
  id: string;
  severity: Severity;
  headline: string;
  /** The number(s) this recommendation was derived from. Never editorial. */
  evidence: string;
  action: AdvisorAction;
};

/** The subset of an `apsomh_content` row the engine reasons about. */
export type AdvisorContentItem = {
  id: number;
  channel: string;
  title: string | null;
  status: string;
  imageUrl: string | null;
  scheduledFor: string | null;
  createdAt: string;
};

/** The subset of the brand brain the engine reasons about. */
export type AdvisorBrainSignals = {
  internalSearchTrends: { term: string; signal: string }[];
  brandTermsMissingLandingPages: string[];
  totalLeafCategories: number;
  categoriesWithSeoText: number;
  contentGap: string;
};

export type AdvisorInput = {
  /** `null` means the library could not be read — NOT that it is empty. */
  items: AdvisorContentItem[] | null;
  /** `null` means the brain could not be read — NOT that it has no signals. */
  brain: AdvisorBrainSignals | null;
  /** Injected so the same input always produces the same output. */
  now: number;
};

/* ── thresholds ───────────────────────────────────────────────────────────
 * Each constant is a judgement about when a number stops being normal and
 * starts being a problem. They are named and commented so the rule the hero
 * applies is auditable rather than buried in a magic literal.
 */

/** One working week: past this the author's context is gone and a draft has
 *  stopped being "in progress" and started being backlog. */
export const STALE_DRAFT_DAYS = 7;

/** Two working weeks: the piece is no longer merely late for review, its
 *  subject matter is going stale too. Escalates the row to `critical`. */
export const CRITICAL_DRAFT_DAYS = 14;

/** Roughly one unreviewed draft per working day of a fortnight. Above this,
 *  review capacity — not generation — is the bottleneck. */
export const CRITICAL_DRAFT_COUNT = 10;

/** Approved work with no date is finished content nobody will ever publish, so
 *  a single one is already worth naming. */
export const UNSCHEDULED_APPROVED_MIN = 1;

/** Below half of leaf categories carrying SEO text, the category tree is the
 *  largest addressable content gap the shop has. */
export const SEO_COVERAGE_TARGET = 0.5;

/** One or two pieces without artwork is normal churn; a handful is a pattern. */
export const MISSING_VISUAL_MIN = 3;

/** How many rows the hero shows. */
export const TOP_RECOMMENDATIONS = 3;

/* ── ranking ──────────────────────────────────────────────────────────────
 * Sort key, in order:
 *   1. severity      — broken beats late beats merely available.
 *   2. kind          — a documented running order inside a severity band, so
 *                      two equally severe rows always resolve the same way.
 *   3. magnitude     — the size of the number behind the row, descending.
 */

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  attention: 1,
  opportunity: 2,
};

const KIND_ORDER = [
  "content-unavailable",
  "brain-unavailable",
  "stale-drafts",
  "draft-backlog",
  "approved-unscheduled",
  "nothing-scheduled",
  "seo-category-gap",
  "demand-signal",
  "missing-visuals",
  "brand-terms-no-page",
  "library-empty",
] as const;

type Kind = (typeof KIND_ORDER)[number];

type Scored = { rec: Recommendation; kind: Kind; magnitude: number };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_MS = 86_400_000;

/** UTC-based so the server route and the browser format the same date. */
function formatDay(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "an unknown date";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function ageInDays(iso: string, now: number): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Encode a grounded topic into a Create Studio deep link. */
export function createStudioHref(channel: string, topic: string): string {
  return `/create?channel=${encodeURIComponent(channel)}&topic=${encodeURIComponent(topic)}`;
}

/* ── safe narrowing of the /api/personality payload ────────────────────── */

function asTrendList(value: unknown): { term: string; signal: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const e = entry as { term?: unknown; signal?: unknown };
    return typeof e?.term === "string" && typeof e?.signal === "string"
      ? [{ term: e.term, signal: e.signal }]
      : [];
  });
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

/**
 * Narrow an unknown brain payload (the raw /api/personality JSON, or a stored
 * Brain) into the signals the engine uses. Returns null when the payload is not
 * a brain at all, so callers can render an honest "source unavailable" state
 * instead of a zeroed-out one.
 */
export function brainSignalsFrom(raw: unknown): AdvisorBrainSignals | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    keywordSignals?: { internalSearchTrends?: unknown; brandTermsMissingLandingPages?: unknown };
    categoryIntelligence?: {
      totalLeafCategories?: unknown;
      categoriesWithSeoText?: unknown;
      contentGap?: unknown;
    };
  };
  if (!r.keywordSignals && !r.categoryIntelligence) return null;
  return {
    internalSearchTrends: asTrendList(r.keywordSignals?.internalSearchTrends),
    brandTermsMissingLandingPages: asStringList(r.keywordSignals?.brandTermsMissingLandingPages),
    totalLeafCategories: asCount(r.categoryIntelligence?.totalLeafCategories),
    categoriesWithSeoText: asCount(r.categoryIntelligence?.categoriesWithSeoText),
    contentGap:
      typeof r.categoryIntelligence?.contentGap === "string" ? r.categoryIntelligence.contentGap : "",
  };
}

/* ── derived content statistics ───────────────────────────────────────── */

export type ContentStats = {
  active: number;
  drafts: number;
  approved: number;
  published: number;
  archived: number;
  staleDrafts: number;
  /** ISO timestamp of the oldest pending draft, or null when there are none. */
  oldestDraftAt: string | null;
  oldestDraftDays: number;
  oldestDraftId: number | null;
  approvedUnscheduled: number;
  scheduledAhead: number;
  missingVisual: number;
  firstMissingVisualId: number | null;
};

/** Pure roll-up of the library. Shared by the engine, the hero and the API. */
export function summariseContent(items: AdvisorContentItem[], now: number): ContentStats {
  const active = items.filter((i) => i.status !== "archived");
  const drafts = active.filter((i) => i.status === "draft");
  const approved = active.filter((i) => i.status === "approved");

  let oldest: AdvisorContentItem | null = null;
  for (const d of drafts) {
    const t = new Date(d.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (!oldest || t < new Date(oldest.createdAt).getTime()) oldest = d;
  }

  const missingVisual = active.filter((i) => !i.imageUrl);

  return {
    active: active.length,
    drafts: drafts.length,
    approved: approved.length,
    published: active.filter((i) => i.status === "published").length,
    archived: items.length - active.length,
    staleDrafts: drafts.filter((d) => ageInDays(d.createdAt, now) >= STALE_DRAFT_DAYS).length,
    oldestDraftAt: oldest ? oldest.createdAt : null,
    oldestDraftDays: oldest ? ageInDays(oldest.createdAt, now) : 0,
    oldestDraftId: oldest ? oldest.id : null,
    approvedUnscheduled: approved.filter((i) => !i.scheduledFor).length,
    scheduledAhead: active.filter((i) => {
      if (!i.scheduledFor) return false;
      const t = new Date(i.scheduledFor).getTime();
      return !Number.isNaN(t) && t > now;
    }).length,
    missingVisual: missingVisual.length,
    firstMissingVisualId: missingVisual.length ? missingVisual[0].id : null,
  };
}

/* ── the engine ───────────────────────────────────────────────────────── */

export function buildAdvice(input: AdvisorInput): Recommendation[] {
  const { items, brain, now } = input;
  const out: Scored[] = [];

  /* ---- library signals ---- */

  if (items === null) {
    out.push({
      kind: "content-unavailable",
      magnitude: 0,
      rec: {
        id: "content-unavailable",
        severity: "critical",
        headline: "The content library could not be read",
        evidence:
          "The library request returned no data, so draft, approval and scheduling counts are unknown — this is a data-source failure, not an empty library.",
        action: { label: "Open the Library", href: "/library" },
      },
    });
  } else {
    const s = summariseContent(items, now);

    if (s.active === 0) {
      out.push({
        kind: "library-empty",
        magnitude: 0,
        rec: {
          id: "library-empty",
          severity: "opportunity",
          headline: "The library is empty — there is nothing to review or schedule yet",
          evidence: `0 active pieces in the library (${s.archived} archived). Everything downstream — the calendar, the approval queue, the pipeline — stays empty until the first piece exists.`,
          action: { label: "Open Create Studio", href: "/create" },
        },
      });
    }

    // Stale drafts: the single most common way work dies in this hub.
    if (s.staleDrafts > 0 && s.oldestDraftAt) {
      const critical = s.oldestDraftDays >= CRITICAL_DRAFT_DAYS || s.drafts >= CRITICAL_DRAFT_COUNT;
      out.push({
        kind: "stale-drafts",
        magnitude: s.staleDrafts,
        rec: {
          id: "stale-drafts",
          severity: critical ? "critical" : "attention",
          headline: `${s.staleDrafts} ${plural(s.staleDrafts, "draft has", "drafts have")} been waiting more than ${STALE_DRAFT_DAYS} days for review`,
          evidence: `${s.drafts} ${plural(s.drafts, "draft is", "drafts are")} in the queue; the oldest has been waiting since ${formatDay(new Date(s.oldestDraftAt).getTime())} (${s.oldestDraftDays} ${plural(s.oldestDraftDays, "day", "days")}).`,
          action: {
            label: "Review the oldest draft",
            href: s.oldestDraftId !== null ? `/library?item=${s.oldestDraftId}` : "/library",
          },
        },
      });
    } else if (s.drafts >= CRITICAL_DRAFT_COUNT && s.oldestDraftAt) {
      // Big queue, but nothing has gone stale yet — worth flagging, not alarming.
      out.push({
        kind: "draft-backlog",
        magnitude: s.drafts,
        rec: {
          id: "draft-backlog",
          severity: "attention",
          headline: `${s.drafts} drafts are queued for review`,
          evidence: `${s.drafts} drafts are pending, the oldest created ${formatDay(new Date(s.oldestDraftAt).getTime())} (${s.oldestDraftDays} ${plural(s.oldestDraftDays, "day", "days")} ago). None has passed the ${STALE_DRAFT_DAYS}-day mark yet.`,
          action: {
            label: "Review the oldest draft",
            href: s.oldestDraftId !== null ? `/library?item=${s.oldestDraftId}` : "/library",
          },
        },
      });
    }

    if (s.approvedUnscheduled >= UNSCHEDULED_APPROVED_MIN) {
      out.push({
        kind: "approved-unscheduled",
        magnitude: s.approvedUnscheduled,
        rec: {
          id: "approved-unscheduled",
          severity: "attention",
          headline: `${s.approvedUnscheduled} approved ${plural(s.approvedUnscheduled, "piece has", "pieces have")} no publication date`,
          evidence: `${s.approvedUnscheduled} of ${s.approved} approved ${plural(s.approved, "piece", "pieces")} ${plural(s.approvedUnscheduled, "carries", "carry")} no scheduled date, so ${plural(s.approvedUnscheduled, "it never appears", "they never appear")} on a future calendar day.`,
          action: { label: "Plan them in the calendar", href: "/calendar" },
        },
      });
    }

    if (s.active > 0 && s.scheduledAhead === 0) {
      out.push({
        kind: "nothing-scheduled",
        magnitude: s.active,
        rec: {
          id: "nothing-scheduled",
          severity: "attention",
          headline: "Nothing at all is scheduled for the days ahead",
          evidence: `0 of ${s.active} active ${plural(s.active, "piece", "pieces")} has a publication date after ${formatDay(now)}.`,
          action: { label: "Open the calendar", href: "/calendar" },
        },
      });
    }

    if (s.missingVisual >= MISSING_VISUAL_MIN) {
      out.push({
        kind: "missing-visuals",
        magnitude: s.missingVisual,
        rec: {
          id: "missing-visuals",
          severity: "opportunity",
          headline: `${s.missingVisual} pieces have never been given a visual`,
          evidence: `${s.missingVisual} of ${s.active} active pieces have no image attached.`,
          action: {
            // Deliberately the Library, not /editor: the visual editor opens a
            // blank canvas for a piece that has no image, which is precisely
            // the state this recommendation is about.
            label: "Add a visual",
            href:
              s.firstMissingVisualId !== null
                ? `/library?item=${s.firstMissingVisualId}`
                : "/library",
          },
        },
      });
    }
  }

  /* ---- brain signals ---- */

  if (brain === null) {
    out.push({
      kind: "brain-unavailable",
      magnitude: 0,
      rec: {
        id: "brain-unavailable",
        severity: "attention",
        headline: "The brand brain could not be read",
        evidence:
          "Demand signals and category coverage come from the brand brain, and it returned no data — those figures are unknown rather than zero.",
        action: { label: "Open the Brand Brain", href: "/personality" },
      },
    });
  } else {
    const total = brain.totalLeafCategories;
    const covered = brain.categoriesWithSeoText;
    const gap = total - covered;
    if (total > 0 && gap > 0) {
      const coverage = covered / total;
      out.push({
        kind: "seo-category-gap",
        magnitude: gap,
        rec: {
          id: "seo-category-gap",
          severity: coverage < SEO_COVERAGE_TARGET ? "attention" : "opportunity",
          headline: `${gap} leaf categories still have no SEO text`,
          evidence: `${covered} of ${total} leaf categories carry SEO text — ${Math.round(coverage * 100)}% covered, ${gap} to go.`,
          action: {
            label: "Write category SEO text",
            href: createStudioHref(
              "seo",
              `Category SEO text for an APSOparts leaf category — ${gap} of ${total} leaf categories still have none`
            ),
          },
        },
      });
    }

    const trend = brain.internalSearchTrends[0];
    if (trend) {
      out.push({
        kind: "demand-signal",
        magnitude: 0,
        rec: {
          id: `demand-signal-${trend.term}`,
          severity: "opportunity",
          headline: `Turn the "${trend.term}" search demand into an article`,
          evidence: `Shop search signal for "${trend.term}": ${trend.signal}`,
          action: {
            label: "Open in Create Studio",
            href: createStudioHref("blog", `${trend.term} — ${trend.signal}`),
          },
        },
      });
    }

    const missingPages = brain.brandTermsMissingLandingPages;
    if (missingPages.length > 0) {
      const shown = missingPages.slice(0, 5).join(", ");
      const rest = missingPages.length - Math.min(5, missingPages.length);
      out.push({
        kind: "brand-terms-no-page",
        magnitude: missingPages.length,
        rec: {
          id: "brand-terms-no-page",
          severity: "opportunity",
          headline: `${missingPages.length} searched brand ${plural(missingPages.length, "term has", "terms have")} no landing page`,
          evidence: `Customers search these brand terms with nothing to land on: ${shown}${rest > 0 ? ` and ${rest} more` : ""}.`,
          action: {
            label: `Create a "${missingPages[0]}" page`,
            href: createStudioHref(
              "seo",
              `Landing page copy for the brand term "${missingPages[0]}" — customers search it but no landing page exists`
            ),
          },
        },
      });
    }
  }

  return out
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.rec.severity] - SEVERITY_RANK[b.rec.severity];
      if (sev !== 0) return sev;
      const kind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (kind !== 0) return kind;
      return b.magnitude - a.magnitude;
    })
    .map((s) => s.rec);
}

/**
 * The grounded fact sheet handed to Claude in /api/advisor. Every line is a
 * figure that exists in `input`; nothing here is estimated. Missing sources are
 * stated as missing so the model can say so instead of filling the hole.
 */
export function advisorFacts(input: AdvisorInput): string[] {
  const { items, brain, now } = input;
  const lines: string[] = [`Today is ${formatDay(now)} ${new Date(now).getUTCFullYear()}.`];

  lines.push("", "CONTENT LIBRARY (table apsomh_content):");
  if (items === null) {
    lines.push("- UNAVAILABLE: the library could not be read. No content figures exist for this answer.");
  } else {
    const s = summariseContent(items, now);
    lines.push(
      `- ${s.active} active pieces (${s.archived} archived and excluded).`,
      `- By status: ${s.drafts} draft, ${s.approved} approved, ${s.published} published.`,
      `- ${s.staleDrafts} drafts have been waiting more than ${STALE_DRAFT_DAYS} days.`,
      s.oldestDraftAt
        ? `- Oldest pending draft: created ${formatDay(new Date(s.oldestDraftAt).getTime())}, ${s.oldestDraftDays} days old.`
        : `- No pending drafts.`,
      `- ${s.approvedUnscheduled} of ${s.approved} approved pieces have no publication date.`,
      `- ${s.scheduledAhead} pieces are scheduled for a date after today.`,
      `- ${s.missingVisual} of ${s.active} active pieces have no image attached.`
    );
  }

  lines.push("", "BRAND BRAIN (demand + category intelligence):");
  if (brain === null) {
    lines.push("- UNAVAILABLE: the brand brain could not be read. No demand or category figures exist for this answer.");
  } else {
    lines.push(
      `- Leaf categories: ${brain.totalLeafCategories} total, ${brain.categoriesWithSeoText} with SEO text, ${Math.max(0, brain.totalLeafCategories - brain.categoriesWithSeoText)} without.`
    );
    if (brain.contentGap) lines.push(`- Stated category gap: ${brain.contentGap}`);
    if (brain.internalSearchTrends.length) {
      lines.push("- Internal shop-search demand signals:");
      for (const t of brain.internalSearchTrends) lines.push(`  · "${t.term}": ${t.signal}`);
    }
    if (brain.brandTermsMissingLandingPages.length) {
      lines.push(
        `- Brand terms searched with no landing page (${brain.brandTermsMissingLandingPages.length}): ${brain.brandTermsMissingLandingPages.join(", ")}.`
      );
    }
  }

  const advice = buildAdvice(input);
  lines.push("", "RANKED RECOMMENDATIONS ALREADY COMPUTED (deterministic engine):");
  if (!advice.length) {
    lines.push("- None. Nothing in the data crosses a defined threshold.");
  } else {
    for (const r of advice) {
      lines.push(`- [${r.id}] (${r.severity}) ${r.headline} — ${r.evidence}`);
    }
  }

  lines.push(
    "",
    "AVAILABLE SURFACES: /create (Create Studio — the only place content is generated), /library (content library, ?item=<id> opens one piece), /calendar, /editor?item=<id> (visual design, only useful when a piece already has an image), /personality (brand brain), /analytics, /geo."
  );

  return lines;
}
