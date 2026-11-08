// APSOconvert > CONTENT'S CALENDAR - a page test's days on the calendar the marketing team plans by (SARCLA 08.11.2026:
// "tests should be solved and then synced with the content calendar for release when it knows pages"): the day it
// starts, the day it can be decided at the earliest (the winner rule's 14 days), and the day its winner is published.
// Through Content's door (src/lib/content/calendarEvents.ts, by the Content studios session): one entry per key, put
// again when a day moves, taken away when it no longer holds. A calendar refusal never stops a test - it is written
// to the log and the test goes on.

import { putCalendarEvent, removeCalendarEvent } from "@/lib/content/calendarEvents";
import { swissNow } from "./scanRules";
import { RULES } from "./stats";
import type { Test } from "./tests";

const DAY_MS = 86_400_000;
const zurichDay = (at: number) => swissNow(new Date(at)).day;
const href = (id: string) => `/website/ai-personalization/tests/${id}`;

/** A page's name from its address: its last part, words instead of dashes, no product number. */
function pageName(path: string | undefined): string {
  const last = (path ?? "").replace(/\.html$/, "").split("/").filter(Boolean).pop() ?? "";
  const words = last.replace(/^\d{8}-/, "").replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path ?? "a shop page";
}

async function quietly(what: string, f: () => Promise<void>): Promise<void> {
  try { await f(); } catch (e) { console.warn(`[convert-calendar] ${what}: ${(e as Error).message}`); }
}

/** A test went on the shop (started, or started again from zero): its day and its earliest decision day. */
export async function calendarStarted(t: Pick<Test, "id" | "env" | "pages" | "kind">, at = Date.now()): Promise<void> {
  if (t.kind !== "test") return;
  const base = { source: "convert" as const, env: t.env, path: t.pages[0], testId: t.id, href: href(t.id) };
  const name = pageName(t.pages[0]);
  await quietly(`#${t.id} start`, () => putCalendarEvent({ ...base, key: `test:${t.id}:start`, kind: "test-start", day: zurichDay(at), title: `Page test #${t.id} starts: ${name}` }));
  await quietly(`#${t.id} end`, () => putCalendarEvent({ ...base, key: `test:${t.id}:end`, kind: "test-end-planned", day: zurichDay(at + RULES.minDays * DAY_MS), title: `Page test #${t.id} can be decided: ${name}` }));
}

/** A test ended (stopped, decided) or was deleted: its planned decision day no longer holds - and with `all`, its start. */
export async function calendarEnded(t: Pick<Test, "id" | "kind">, all = false): Promise<void> {
  if (t.kind !== "test") return;
  await quietly(`#${t.id} end off`, () => removeCalendarEvent("convert", `test:${t.id}:end`));
  if (all) await quietly(`#${t.id} start off`, () => removeCalendarEvent("convert", `test:${t.id}:start`));
}

/** A test's winner went out to the shop (from Content): its day. */
export async function calendarPublished(t: Pick<Test, "id" | "env" | "pages">, way: string, projectId: number | null = null, at = Date.now()): Promise<void> {
  const name = pageName(t.pages[0]);
  await quietly(`#${t.id} published`, () => putCalendarEvent({
    source: "convert", key: `test:${t.id}:published`, kind: "winner-published", day: zurichDay(at),
    title: `Winner of page test #${t.id} published (${way === "cms" ? "Magento" : way === "everyone" ? "on for everyone" : "code for dotSource"}): ${name}`,
    href: href(t.id), env: t.env, path: t.pages[0], testId: t.id, projectId,
  }));
}
