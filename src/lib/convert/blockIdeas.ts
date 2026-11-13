// APSOconvert > OPTIMIZATIONS PER BLOCK (server) - what ./blockRules.ts decides, done.
//
// SARCLA 10.11.2026: "we cannot say where it is" -> an optimization is ONE block of the page, and for now (phase 1) its
// versions REPLACE that block with modules of the Content library - "3 or 4 versions", really different, side by side
// against the block as it is (the way the newsletter band's proposals were picked: many side by side, never one at a
// time). Later: the module itself changed (its words, its call to action, its place from the clicks).
//   1. the page's blocks (the Content studio's places.ts pageMap; a shop block outside the main column - the newsletter
//      band - as a part of its own) with the clicks each one gets (the click map) against the thresholds
//   2. ONE AI call: the page's reading, 1-3 blocks to optimize, for each 3-4 versions - a module of the library each, with
//      its words for this page (its language), its fill, its links
//   3. each version checked the studio's way (cleanPlan), filled from the shop and FULL, drawn by the library's renderer
//   4. saved: the optimization (scope "block", its block's selector and name) with its versions A, B, C (D) - nothing
//      left to build when a person opens it
// Product pages get none for now: their layout is the theme's code.

import { brandSystemPrompt, readBrain } from "@/lib/brain";
import { changeId, emptyPage, languageOfStore, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { pageLinks, pageMap } from "@/lib/content/studio/kinds/page/plan/places";
import { PLAN_SCHEMA, cleanPlan, pageWords, planSystem } from "@/lib/content/studio/kinds/page/plan/plan";
import { libModule } from "@/lib/content/studio/kinds/page/plan/library";
import { treeFor } from "@/lib/content/studio/kinds/page/plan/fill";
import { query } from "@/lib/db/client";
import { classify, type Env } from "./model";
import { clicksOf } from "./clicks";
import { buildSteps, keepSafe } from "./modular";
import { BLOCK, REWORK_ANGLES, REWORK_PART, blockPage, blocksIn, clicksPerPart, isRework, nameOf, partsWithClicks, reworkPage, shopPart, versionLabel, versionStep, weakBlock } from "./blockRules";
import { typeOfBlock } from "./changeTypes";
import { VERSION_LETTERS, addIdea, ask, pageWork, saveVersionOf, setIdeaStatus, shopPage, writeVersion, type AiResult, type BlockFocus, type Idea, type Numbers } from "./studio";

/** One version's schema: a step of the Content plan without what the hub sets (it REPLACES the block), with its label. */
const STEP = (PLAN_SCHEMA.properties.steps as { items: { required: string[]; properties: Record<string, unknown> } }).items;
const OWN = ["do", "at", "where", "html"];
const VERSION_SCHEMA = {
  type: "object", additionalProperties: false,
  required: [...STEP.required.filter((k) => !OWN.includes(k)), "label"],
  properties: {
    ...Object.fromEntries(Object.entries(STEP.properties).filter(([k]) => !OWN.includes(k))),
    label: { type: "string", description: "What makes this version different, ENGLISH, under 8 words" },
  },
};
const BLOCKS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["reading", "blocks"],
  properties: {
    reading: { type: "string", description: "ENGLISH, 2-3 sentences: what the page does well and which blocks hold buyers back, with their click numbers" },
    blocks: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["at", "title", "why", "expect", "versions"],
        properties: {
          at: { type: "string", description: "The block's id from THE PAGE'S BLOCKS (P3, S1)" },
          title: { type: "string", description: "What the optimization does to that block, ENGLISH, under 10 words" },
          why: { type: "string", description: "ENGLISH, 1-2 sentences: the numbers that point to it - its clicks against the page's, what it holds" },
          expect: { type: "string", description: "ENGLISH, 1 sentence: what should move (clicks on the block, add-to-carts, sign-ups)" },
          versions: { type: "array", items: VERSION_SCHEMA },
        },
      },
    },
  },
};

const FRAME = `THIS TIME YOU DO NOT PLAN THE WHOLE PAGE: you propose OPTIMIZATIONS OF ITS BLOCKS for an A/B test (APSOconvert).
An optimization is ONE block of the page ("at" = its id in THE PAGE'S BLOCKS) that holds buyers back, and ${BLOCK.minVersions} or
${BLOCK.maxVersions} VERSIONS of it - each a module of THE LIBRARY that REPLACES the whole block. The block as it is and its
versions are tested against each other, so the versions are REALLY different from each other: another module, another
layout, another angle (proof, products, a clear next step, answers) - never the same module with other words.
Which blocks: first those WEAK by the thresholds (they hold something to click and the page's clicks pass them by), then
blocks whose job a module does clearly better (a slider of pictures, a wall of text with links buried in it, a list of
links without pictures, a quote nobody acts on). Never the block that holds the page's H1, never legal text, never a
block a buyer needs exactly as it is (a product's data, an address to write to). 1 to ${BLOCK.maxBlocks} blocks, the most
promising first. A version keeps the block's job: a block that leads to a sign-up, an account or a contact still leads
there (its button's "link" one of the addresses below), with a stronger reason to go.
A BUTTON NAMES THE PAGE IT OPENS: its words say that page's name ("Zu den O-Ringen", "Dichtungstechnik ansehen") and
its "link" is exactly that address. Never "all products", "all categories", "all technologies", "the whole range" in
any language ("Alle Produkte", "Alle Kategorien", "Zum Sortiment", "Tout l'assortiment") - the shop has no such page in
the lists below (the hub leaves such a button out); a module of categories shows the range by itself.
NO STOCK OR DELIVERY PROMISE in any words ("Direkt ab Lager", "sofort lieferbar", "in stock") - the hub cuts the sentence.
Each version: "module" (an id of THE LIBRARY), "layout", its "words" written for this page in the page's language
(FULL - every word the module takes), "fill" (how the hub fills it from the shop), "link"/"link2", "why" (ENGLISH, under
10 words) and "label" (ENGLISH, under 8 words: what makes it different). Every fact only from the page and the brand.`;

export async function proposeBlocks(env: Env, path: string, numbers: Numbers | null, by: string, focus: BlockFocus | null = null): Promise<AiResult<Idea[]>> {
  const page = await shopPage(env, path);
  if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for this page.` };
  if (!blockPage(page.kind)) return { ok: false, error: "Product pages come later: their layout is the theme's code, so no optimization is proposed there for now." };
  // a home page is reworked as a whole, never block by block (SARCLA 13.11.2026) - its shop blocks keep their own
  if (!focus && reworkPage(page.kind)) return proposeRework(env, path, numbers, by, page);
  const store = classify(path).store ?? "de-CH";
  const language = languageOfStore(store) ?? "German";
  const view: PageDoc = { ...emptyPage(), env, path, store, changes: [] };
  const map = pageMap(page.html, view);
  const parts = [...map.parts];
  let focusId: string | null = null;
  if (focus) {
    const sel = focus.focus ?? focus.selector;
    const inPage = parts.find((p) => p.selector === sel);
    if (inPage) focusId = inPage.id;
    else {
      const sp = shopPart(page.html, sel, focus.name);
      if (!sp) return { ok: false, error: `${focus.name} was not found on ${path}.` };
      parts.push(sp);
      focusId = sp.id;
    }
  }
  if (!parts.length) return { ok: false, error: "The page's blocks could not be read." };

  const [heat, tree, brain, work] = await Promise.all([
    clicksOf(env, path).catch(() => null), treeFor(store).catch(() => []), readBrain().catch(() => null), pageWork(env, path),
  ]);
  const clicks = heat?.heat?.list.length ? clicksPerPart(page.html, parts, heat.heat.list) : null;
  const links = pageLinks(page.html, store);
  // a block that has an optimization waiting or approved is not proposed again
  const taken = new Set(work.ideas.filter((i) => i.scope === "block" && i.status !== "dropped" && i.target).map((i) => i.target!));
  const takenIds = parts.filter((p) => taken.has(p.selector)).map((p) => p.id);
  if (focusId && takenIds.includes(focusId)) return { ok: false, error: `${focus!.name} has an optimization waiting already.` };

  const n = numbers;
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? "-" : `${(x * 100).toFixed(1)}%`);
  const user = `PAGE: ${page.url} · ${page.kind} page · store view ${store} (${language})
NUMBERS${n?.from ? ` (${n.from} to ${n.to})` : ""}: ${n ? `${n.views ?? "-"} views, ${n.addToCarts ?? "-"} add-to-carts, cart rate ${pct(n.rate)} (typical ${pct(n.typical)}); why it is on the problem list: ${(n.reasons ?? []).join(" / ") || "-"}` : "none yet"}
CLICKS: ${clicks ? `${clicks.total} clicks on the page in the last ${heat?.from && heat?.to ? `days ${heat.from} to ${heat.to}` : "weeks"} (${clicks.elsewhere} on the header, footer or parts drawn later). Thresholds: a block holding something to click is WEAK under ${BLOCK.weakShare * 100}% of the page's clicks, once the page has ${BLOCK.minClicks} clicks.` : "not counted on this page yet - judge the blocks by what they hold and where they stand"}

THE PAGE'S BLOCKS, IN THEIR ORDER (id · name · what it holds · clicks, then its words):
${partsWithClicks(parts, clicks)}
${takenIds.length ? `\nBLOCKS THAT HAVE AN OPTIMIZATION ALREADY (not again): ${takenIds.join(", ")}\n` : ""}
THE SHOP'S CATEGORIES (for "fill" and a button's link: address · name):
${tree.length ? tree.slice(0, 120).map((t) => `${"  ".repeat(t.depth)}${t.url} · ${t.name}`).join("\n") : "(not read - fill with \"bought\", \"viewed\" or \"page\")"}

THE SHOP'S PAGES YOU MAY LINK (address · its words):
${links.slice(0, 40).map((l) => `${l.url} · ${l.text}`).join("\n") || "(none)"}

WRITE THE MODULES' WORDS IN: ${language} (store view ${store}). Everything else in English.
${focus ? `\nTHE BLOCK TO OPTIMIZE: ${focusId} - ${focus.name}. What it is: ${focus.about}. Its goal: ${focus.goal}.\nPropose exactly ONE optimization: "at" = ${focusId}, with ${BLOCK.minVersions} or ${BLOCK.maxVersions} versions.` : `\nPropose 1 to ${BLOCK.maxBlocks} block optimizations for this page.`}`;
  const system = `${brain ? `${brandSystemPrompt(brain, "seo")}\n\n` : ""}${planSystem()}\n\n${FRAME}`;
  const r = await ask<Record<string, unknown>>(system, user, BLOCKS_SCHEMA, 14000);
  if (!r.ok) return r;

  const reading = String((r.data as { reading?: unknown }).reading ?? "").trim().slice(0, 1200);
  if (reading) {
    await query(`INSERT INTO apsomh_convert_analyses (env, path, text, by_whom, at) VALUES ($1, $2, $3, $4, now())
                 ON CONFLICT (env, path) DO UPDATE SET text = EXCLUDED.text, by_whom = EXCLUDED.by_whom, at = now()`, [env, path, reading, by]);
  }
  const picked = blocksIn(r.data, parts.filter((p) => !takenIds.includes(p.id)), focusId);
  const problems = [...picked.problems];
  const facts = brain ? JSON.stringify([brain.brandVoice, brain.positioningGuard, brain.productContentRules]) : "";
  const linkNames = Object.fromEntries([...tree.map((t) => [t.url, t.name]), ...links.map((l) => [l.url, l.text])]);
  const ctx = {
    parts, container: map.container, categories: tree.map((t) => t.url), links: links.map((l) => l.url), linkNames,
    pageUrl: `https://www.apsoparts.com${path}`, pageKind: page.kind, pageText: `${pageWords(parts)} ${facts}`, newId: () => changeId(), lang: store.slice(0, 2), store,
  };
  const own = new Set(parts.map((p) => p.selector).filter(Boolean));
  const out: Idea[] = [];
  for (const b of picked.blocks) {
    const part = parts.find((p) => p.id === b.at)!;
    // each version: one step that replaces the block, checked the studio's way, filled, drawn
    const made: { label: string; sig: string; changes: Awaited<ReturnType<typeof buildSteps>>["made"] }[] = [];
    for (const v of b.versions) {
      if (made.length >= BLOCK.maxVersions) break;
      const plan = cleanPlan({ note: "", steps: [versionStep(v, b.at)] }, ctx);
      problems.push(...plan.problems);
      if (!plan.steps.length) continue;
      const built = await buildSteps(plan.steps, [], store, page.kind === "category" ? path : null);
      problems.push(...built.problems);
      const kept = keepSafe(built.made, own, problems);
      if (!kept.length) continue;
      // two versions of the same module and layout are one (the versions must really differ)
      const sig = `${plan.steps[0].module}|${plan.steps[0].layout}`;
      if (made.some((m) => m.sig === sig)) { problems.push(`${b.at}: a version repeated another's module - left out`); continue; }
      made.push({ label: versionLabel(v, libModule(plan.steps[0].module)?.name ?? ""), sig, changes: kept });
    }
    if (made.length < 2) { problems.push(`${b.at}: fewer than 2 versions could be made - left out`); continue; }
    const name = nameOf(parts, b.at);
    const idea = await addIdea(env, path, {
      title: b.title, why: b.why, expect: b.expect,
      change: `${name} is replaced by one of ${made.length} modules: ${made.map((m, i) => `${VERSION_LETTERS[i]} - ${m.label}`).join("; ")}.`,
      target: part.selector, type: focus?.key ? typeOfBlock(focus.key) : "page-refresh", block: focus?.key ?? null, scope: "block", part: name,
    }, by, "ai", numbers);
    for (let i = 0; i < made.length; i++) await saveVersionOf(idea, made[i].changes, made[i].label, by, VERSION_LETTERS[i]);
    out.push(idea);
  }
  if (!out.length) return { ok: false, error: problems[0] ?? "The AI proposed no block that could be built." };
  if (problems.length) console.log(`[convert-blocks] ${path}: ${out.length} optimizations; ${problems.slice(0, 4).join(" | ")}`);
  return { ok: true, data: out };
}

/**
 * THE WHOLE HOME PAGE REWORKED (SARCLA 13.11.2026: "here the whole page needs to be reworked - the home page needs to be
 * reworked completely; a recommendation of blocks makes no sense"): ONE optimization, its versions each the page rebuilt
 * from the library's modules with another angle (./blockRules.ts REWORK_ANGLES) - one AI ask per version, the Content
 * studio's way (./modular.ts, FRAME_REWORK). Nothing is proposed while the page has a rework open.
 */
async function proposeRework(env: Env, path: string, numbers: Numbers | null, by: string, page: Awaited<ReturnType<typeof shopPage>>): Promise<AiResult<Idea[]>> {
  const work = await pageWork(env, path);
  if (work.ideas.some((i) => i.status !== "dropped" && isRework(i))) return { ok: false, error: "This home page has its rework waiting already." };
  const store = classify(path).store ?? "de-CH";
  const view: PageDoc = { ...emptyPage(), env, path, store, changes: [] };
  const parts = pageMap(page.html, view).parts;
  const heat = await clicksOf(env, path).catch(() => null);
  const clicks = heat?.heat?.list.length ? clicksPerPart(page.html, parts, heat.heat.list) : null;
  const weak = clicks ? parts.filter((p) => weakBlock(p, clicks.parts.find((c) => c.id === p.id), clicks.total)).length : 0;
  const why = clicks && clicks.total >= BLOCK.minClicks
    ? `${weak} of the page's ${parts.length} blocks hold something to click and get under ${BLOCK.weakShare * 100}% of its ${clicks.total} clicks each - the page as a whole does not lead buyers into the shop.`
    : `The shop's door: ${parts.length} blocks, mostly pictures, sliders and rows of banners a buyer cannot act on - the page as a whole does not lead buyers into the shop.`;
  const idea = await addIdea(env, path, {
    title: "Rework the whole home page",
    why,
    change: `Every block a module does better is rebuilt from the library, in the order a buyer needs them - ${REWORK_ANGLES.length} versions, each with its angle: ${REWORK_ANGLES.map((a, k) => `${VERSION_LETTERS[k]} ${a.label.toLowerCase()}`).join(", ")}.`,
    expect: "More clicks from the first screen into the shop's ranges and products, and more add-to-carts per visit.",
    impact: 5, confidence: 3, effort: 4, type: "page-refresh", scope: "page", part: REWORK_PART,
  }, by, "ai", numbers);
  const problems: string[] = [];
  let made = 0;
  for (let k = 0; k < REWORK_ANGLES.length; k++) {
    const a = REWORK_ANGLES[k];
    const r = await writeVersion(idea.id, `${a.request} (version ${VERSION_LETTERS[k]}: ${a.label})`, by, null, k === 0 ? { letter: "A" } : { another: true });
    if (r.ok) { made++; problems.push(...r.data.problems.slice(0, 2)); continue; }
    problems.push(`${VERSION_LETTERS[k]}: ${r.error}`);
    if (/times today/.test(r.error)) break;
  }
  if (!made) {
    await setIdeaStatus(idea.id, "dropped", "the AI's rework: no version could be built");
    return { ok: false, error: problems[0] ?? "No version of the rework could be built." };
  }
  console.log(`[convert-blocks] ${path}: the whole page reworked - ${made} versions${problems.length ? `; ${problems.slice(0, 3).join(" | ")}` : ""}`);
  return { ok: true, data: [idea] };
}
