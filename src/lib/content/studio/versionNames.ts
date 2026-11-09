// A TO-DO'S VERSIONS, NAMED FOR A PERSON (SARCLA 09.11.2026: "Versions is not working correctly as it should"). Pure,
// shared with the browser and the tests.
//
// What each version is and when, in the Versions menu: "Kept by Claudio · 10:12", a name a person gave it, "Before the
// AI wrote the page" - never the number an AI change is found again by ("… #1794201096866"). And which AI tasks write the
// WHOLE thing, so the studio keeps a version on its own just before them (useStudio.ts): bringing the thing back from an
// AI that wrote over it is one click in Versions.

/** The mark every automatic version's label starts with - the same as store.ts AUTO_VERSION (the server adds it). */
export const AUTO_MARK = "Before the AI:";

export type VersionRow = { id: number; label: string | null; by: string | null; at: string };
export type VersionName = { title: string; sub: string; auto: boolean };

/**
 * The label of the version kept just before an AI task that writes the whole thing (or null: the task changes a part,
 * or the studio keeps its own version before each change - the blog's and the newsletter's "Changes made here").
 */
export function wholeTaskLabel(kind: string, task: string, input: Record<string, unknown> = {}): string | null {
  const say = (what: string) => `${AUTO_MARK} ${what}`;
  switch (`${kind}:${task}`) {
    case "page:fill_all": return say("wrote the page");
    case "page:rewrite": return say(input.selector ? "changed a part of the page" : "changed the page");
    case "page:translate": return say(typeof input.to === "string" && input.to ? `translated the page into ${input.to.toUpperCase()}` : "translated the page");
    case "social:write": return say("wrote the post's texts");
    case "banner:copy": return say(input.ask ? "changed the banner's words" : "wrote the banner's words");
    case "video:storyboard": return say("wrote the film");
    case "video:revise": return say("changed the film");
    case "video:tighten": return say("shortened every line");
    default: return null;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
/** "10:12" today, "Yesterday 10:12", "8 Nov 10:12" before - in the viewer's own time. */
export function whenLabel(at: string, now: Date = new Date()): string {
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return "";
  const hm = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (day(t) === day(now)) return hm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (day(t) === day(y)) return `Yesterday ${hm}`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${t.getDate()} ${months[t.getMonth()]}${t.getFullYear() === now.getFullYear() ? "" : ` ${t.getFullYear()}`} ${hm}`;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** What a blog's or newsletter's own "Before: <the change>" says, said as a person would. */
function beforeChange(text: string): string {
  const t = text.trim();
  if (/^The post:/i.test(t)) return "Before the AI wrote the post";
  if (/^The whole newsletter:/i.test(t)) return "Before the AI wrote the newsletter";
  const tr = /^Translated into ([A-Za-z]+)/.exec(t);
  if (tr) return `Before the AI translated it into ${tr[1]}`;
  const lay = /^Layout: ([^-–]+?)\s*(?:[-–]|$)/.exec(t);
  if (lay) return `Before the layout “${lay[1].trim()}”`;
  return `Before: ${clip(t.replace(/[.\s]+$/, ""), 64)}`;
}

/**
 * A version as the menu says it: what it is (title) and who kept it, when (sub). `nameOf` gives a person's name from
 * their username; `me` is the person looking ("Kept by you").
 */
export function versionName(v: VersionRow, o: { nameOf?: (username: string) => string; me?: string | null; now?: Date } = {}): VersionName {
  const when = whenLabel(v.at, o.now);
  const who = v.by ? (o.me && v.by === o.me ? "you" : (o.nameOf?.(v.by) ?? v.by).split(/[\s@.]/)[0] || v.by) : null;
  const label = (v.label ?? "").replace(/\s#\d{6,}\s*$/, "").trim();
  const kept = who ? `Kept by ${who}` : "Kept";
  if (!label) return { title: kept, sub: when, auto: false };
  const own = (title: string): VersionName => ({ title, sub: `Kept on its own · ${when}`, auto: true });
  if (label.startsWith(AUTO_MARK)) {
    const rest = label.slice(AUTO_MARK.length).trim();
    if (/^Before:\s*/.test(rest)) return own(beforeChange(rest.replace(/^Before:\s*/, "")));
    if (/^(wrote|changed|translated|shortened|made|rewrote)\b/.test(rest)) return own(`Before the AI ${rest}`);
    return own(`Before the AI: ${clip(rest || "a change", 64)}`);
  }
  if (/^Before:\s*/.test(label)) return own(beforeChange(label.replace(/^Before:\s*/, "")));
  if (/^Before (bringing back|going back)/.test(label)) return own(clip(label, 80));
  return { title: clip(label, 80), sub: `${kept} · ${when}`, auto: false };
}
