// OTHER APPS ON THE CONTENT CALENDAR - the rules (pure, tested). lib/content/calendarEvents.ts keeps them.
// SARCLA 08.11.2026 on AI testing & personalization: "tests should be solved and then synced with the content calendar
// for release when it knows pages". An app puts a dated entry on Content's calendar (a page test starts, its planned
// end, a winner published) under its own stable key, and moves it by putting it again.

export const EVENT_SOURCES = ["convert"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];
export const SOURCE_NAME: Record<EventSource, string> = { convert: "AI testing & personalization" };

export const EVENT_KINDS = ["test-start", "test-end-planned", "winner-published"] as const;
export type CalendarEventKind = (typeof EVENT_KINDS)[number];
export const KIND_LABEL: Record<CalendarEventKind, string> = {
  "test-start": "Page test starts", "test-end-planned": "Page test ends (planned)", "winner-published": "Winner published",
};

export type CalendarEventInput = {
  source: EventSource; key: string; kind: CalendarEventKind; day: string; title: string; href: string;
  env?: "prod" | "acc"; path?: string; testId?: string; projectId?: number | null;
};
export type CalendarEvent = Required<Omit<CalendarEventInput, "env" | "path" | "testId" | "projectId">> & {
  env: "prod" | "acc" | null; path: string | null; testId: string | null; projectId: number | null;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A real calendar day "YYYY-MM-DD" (never a timestamp: a DATE read back as a Date shifts a day in Zurich). */
export function isDay(s: unknown): s is string {
  const m = typeof s === "string" ? DAY.exec(s) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** An address inside the hub only - an entry never sends a person elsewhere. */
export function isHubPath(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("/") && !s.startsWith("//") && !/[\s<>"']/.test(s) && s.length <= 500;
}

/** The entry checked and trimmed, or the reason it is refused. */
export function eventFrom(x: CalendarEventInput): { ok: true; event: CalendarEvent } | { ok: false; error: string } {
  if (!(EVENT_SOURCES as readonly string[]).includes(x.source)) return { ok: false, error: "Unknown source." };
  if (!(EVENT_KINDS as readonly string[]).includes(x.kind)) return { ok: false, error: "Unknown kind." };
  const key = String(x.key ?? "").trim();
  if (!key || key.length > 200) return { ok: false, error: "A key is needed (max 200)." };
  if (!isDay(x.day)) return { ok: false, error: "The day must be YYYY-MM-DD." };
  const title = String(x.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!title) return { ok: false, error: "A title is needed." };
  if (!isHubPath(x.href)) return { ok: false, error: "The link must be a hub address (/…)." };
  const projectId = typeof x.projectId === "number" && Number.isInteger(x.projectId) && x.projectId > 0 ? x.projectId : null;
  return {
    ok: true,
    event: {
      source: x.source, key, kind: x.kind, day: x.day, title, href: x.href,
      env: x.env === "prod" || x.env === "acc" ? x.env : null,
      path: typeof x.path === "string" && x.path.startsWith("/") ? x.path.slice(0, 400) : null,
      testId: typeof x.testId === "string" && /^\d{1,12}$/.test(x.testId) ? x.testId : null,
      projectId,
    },
  };
}
