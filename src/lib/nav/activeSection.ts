// WHICH APP'S PANEL OPENS ON A PAGE.
//
// A section of the side panel may list a page belonging to another app, as a
// door into it: Digital Growth lists UC's "Use Cases Overview" at that page's
// own address, /uc/lifecycle, so it stays behind UC's grant (SARCLA,
// 21.10.2026: "bring the UC nutshell as it is on HubSpot apps, exactly the
// same"). The door is wanted. What it must not do is change whose page it is.
//
// It did. The panel took the FIRST section listing the address, and the report
// categories are spliced into the list ahead of the apps - so the launch pad's
// "UC & HubSpot Apps" tile, which lands on /uc/lifecycle, opened Digital
// Growth's menu instead: its stage pages where UC's apps should be, and a way
// out leading to Advanced reporting. UC's own pages were unreachable from the
// tile (SARCLA, 22.10.2026: "i can't open anymore HUBSPOT apps it redirected to
// the digital growth KPI").
//
// The same trap sits one line above in hubApps.ts, where the UC tile is warned
// never to point at /uc/price-checks. That warning is about one address; this
// is the rule behind it, so the next cross-link cannot spring it again: of the
// sections listing a page, the one that OWNS the page wins.

import { appForPath } from "../auth/access";

/** Only what the rule reads - the real sections carry icons and labels besides. */
export type NavShape = {
  home?: string;
  items: { href: string; children?: { href: string }[] }[];
};

/**
 * Which app a section belongs to: its own page when it has one, otherwise
 * whichever app most of its pages sit under.
 *
 * Counted, not taken from the first entry: a borrowed page in the list must not
 * be able to rename the section's app, wherever in the list it sits.
 */
export function appOfSection(s: NavShape): string | null {
  if (s.home) return appForPath(s.home.split("?")[0]);
  const tally = new Map<string, number>();
  for (const i of s.items) {
    const app = appForPath(i.href.split("?")[0]);
    if (app) tally.set(app, (tally.get(app) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const e of tally) if (!best || e[1] > best[1]) best = e;
  return best?.[0] ?? null;
}

/** Does this section list that exact address? */
export function listsHref(s: NavShape, href: string): boolean {
  return (
    s.home === href ||
    s.items.some((i) => i.href === href || i.children?.some((c) => c.href === href))
  );
}

/**
 * The section whose panel opens on `activeHref`.
 *
 * One section listing it is the answer. Several, and the page's own app decides;
 * if none of them owns it - a page under no app, or one only a foreign section
 * lists - the first stays the answer, which is what the panel did before.
 */
export function pickActiveSection<T extends NavShape>(sections: T[], activeHref: string): T | undefined {
  const here = sections.filter((s) => listsHref(s, activeHref));
  if (here.length < 2) return here[0];
  const app = appForPath(activeHref.split("?")[0]);
  return here.find((s) => appOfSection(s) === app) ?? here[0];
}
