import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyNewsletter, newBlock, type Block, type NewsletterDoc } from "../src/lib/content/studio/kinds/newsletter/model";
import { blocksFrom, draftFrom, groupEmails, readEmail, type RawEmail, type SourceEmail } from "../src/lib/content/studio/kinds/newsletter/ourEmails";
import { afterRefusal, baseFor, draftAction, madeNote, makeDraft, refsOf, statusOf, widgetMap, type HubspotCall } from "../src/lib/content/studio/kinds/newsletter/drafts";
import { draftOf, draftRows, makeAllOf, translationBase, versionIn, versionSig, withVersion } from "../src/lib/content/studio/kinds/newsletter/langs";

// cv17 (SARCLA 11.11.2026: "continue"): one HubSpot draft per language, updated in place while it still is a draft there;
// each language's draft made from the campaign's own e-mail in that language when HubSpot proves it has one. A fake
// HubSpot only - made-up e-mails in HubSpot's shape, never a real call.

const TEMPLATE = "@hubspot/email/dnd/Start_from_scratch.html";
const section = (...ids: string[]) => ids.map((w) => ({ columns: [{ widgets: [w] }] }));

/** Our German campaign e-mail (the one the newsletter is started from). */
const DE: SourceEmail = {
  id: 100, name: "DE_Gaskets_2611", subject: "Dichtungen nach Mass", language: "de",
  from: { fromName: "APSOparts®" }, subscriptionDetails: { subscriptionId: "156534172", subscriptionName: "Marketing Information" },
  content: {
    templatePath: TEMPLATE, styleSettings: { bodyColor: "#fff" },
    flexAreas: { main: { sections: section("web", "hero", "intro", "btn1", "pic2", "story2", "btn2", "foot") } },
    widgets: {
      web: { body: { path: "@hubspot/email_web_version_link" } },
      hero: { body: { path: "@hubspot/image_email", img: { src: "https://cdn.example.com/de-hero.png", alt: "Held" } } },
      intro: { body: { module_id: 1155639, html: "<h2>Nach Mass geschnitten</h2><p>Dichtungen auf den Millimeter genau - in zwei Klicks bestellt.</p>" } },
      btn1: { body: { path: "@hubspot/button_email", text: "JETZT TESTEN", destination: "https://www.apsoparts.com/de-CH/directcut" } },
      pic2: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/de-two.png", alt: "Zwei" } } },
      story2: { body: { module_id: 1155639, html: "<p><strong>Schon DirectUP probiert?</strong></p><p>Aus einer PDF-Bestellung wird eine Shop-Bestellung, die Teile gefunden.</p>" } },
      btn2: { body: { path: "@hubspot/button_email", text: "BESTELLUNG HOCHLADEN", destination: "https://www.apsoparts.com/de-CH/directup" } },
      foot: { body: { path: "@hubspot/email_footer" } },
      preview_text: { type: "text", body: { value: "Zwei Klicks, jede Grösse" } },
    },
  },
};

/** The same campaign in French: a clone in HubSpot - most widgets keep their id, one button got a new one; its own
 *  pictures, its fr-CH addresses, its own footer settings. */
const FR: SourceEmail = {
  id: 200, name: "FR_Gaskets_2611", subject: "Joints sur mesure", language: "fr",
  from: { fromName: "APSOparts® FR" }, subscriptionDetails: { subscriptionId: "156534172", subscriptionName: "Marketing Information", officeLocationId: "fr" },
  content: {
    templatePath: TEMPLATE, styleSettings: { bodyColor: "#fff" },
    flexAreas: { main: { sections: section("web", "hero", "intro", "btn1", "pic2", "story2", "btn2fr", "foot") } },
    widgets: {
      web: { body: { path: "@hubspot/email_web_version_link" } },
      hero: { body: { path: "@hubspot/image_email", img: { src: "https://cdn.example.com/fr-hero.png", alt: "Héros" } } },
      intro: { body: { module_id: 1155639, html: "<h2>Coupé sur mesure</h2><p>Des joints au millimètre près.</p>" } },
      btn1: { body: { path: "@hubspot/button_email", text: "ESSAYER", destination: "https://www.apsoparts.com/fr-CH/directcut" } },
      pic2: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/fr-two.png", alt: "Deux" } } },
      story2: { body: { module_id: 1155639, html: "<p><strong>Déjà essayé DirectUP ?</strong></p><p>Une commande PDF devient une commande du shop.</p>" } },
      btn2fr: { body: { path: "@hubspot/button_email", text: "TÉLÉCHARGER UNE COMMANDE", destination: "https://www.apsoparts.com/fr-CH/directup" } },
      foot: { body: { path: "@hubspot/email_footer" } },
      preview_text: { type: "text", body: { value: "Deux clics" } },
    },
  },
};

/** The Italian one was rebuilt by hand: other ids, another order - nothing proves where the parts are. */
const IT: SourceEmail = {
  id: 300, name: "IT_Gaskets_2611", subject: "Guarnizioni su misura", language: "it",
  content: {
    templatePath: TEMPLATE,
    flexAreas: { main: { sections: section("x1", "x2", "x3") } },
    widgets: {
      x1: { body: { module_id: 1155639, html: "<p>Testo</p>" } },
      x2: { body: { path: "@hubspot/image_email", img: { src: "https://cdn.example.com/it.png", alt: "" } } },
      x3: { body: { path: "@hubspot/button_email", text: "PROVA", destination: "https://www.apsoparts.com/it-CH/directcut" } },
    },
  },
};

const sent = (id: string, name: string, language: string, subject: string, date = "2026-11-04"): RawEmail => ({
  id, name, language, subject, state: "AUTOMATED", type: "AUTOMATED_EMAIL", publishDate: `${date}T09:00:00Z`, stats: { counters: { sent: 900, delivered: 900, open: 90, click: 9 } },
});
const GROUPS = groupEmails([
  sent("100", "DE_Gaskets_2611", "de", "Dichtungen nach Mass"), sent("200", "FR_Gaskets_2611", "fr", "Joints sur mesure"),
  sent("300", "IT_Gaskets_2611", "it", "Guarnizioni su misura"), sent("400", "Gaskets_NL", "nl", "Pakkingen op maat"),
]);

/** The newsletter started from the German e-mail, and its French e-mail translated in the studio. */
function newsletter(): NewsletterDoc {
  const read = readEmail(DE);
  const blocks = [...blocksFrom(read.parts, read.subject), newBlock("footer", "foot", "DE")];
  return { ...emptyNewsletter("DE"), subject: "Dichtungen nach Mass", preheader: "Zwei Klicks", blocks, startedFrom: { emailId: "100", subject: "Dichtungen nach Mass", language: "DE", date: "2026-11-04" } };
}
function french(de: NewsletterDoc): NewsletterDoc {
  const t = translationBase(de, "FR");
  const blocks = t.blocks.map((b): Block => {
    if (b.kind === "hero") return { ...b, headline: "Coupé sur mesure", text: "Des joints au millimètre près - commandés en deux clics.", button: { ...b.button, label: "ESSAYER MAINTENANT" } };
    if (b.kind === "article") return { ...b, title: "Déjà essayé DirectUP ?", text: "Une commande PDF devient une commande du shop, les pièces trouvées.", link: { ...b.link, label: "TÉLÉCHARGER" } };
    return b;
  });
  return { ...t, subject: "Joints sur mesure", preheader: "Deux clics", blocks };
}

/** A fake HubSpot: the e-mails it has, every call kept; a status thrown as the hub's IntegrationError carries it. */
function fakeHubspot(o: { emails?: Record<string, unknown>; fail?: Record<string, number>; nextId?: number } = {}) {
  const emails: Record<string, unknown> = { "100": DE, "200": FR, "300": IT, ...(o.emails ?? {}) };
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  let next = o.nextId ?? 900;
  const err = (status: number, message: string) => Object.assign(new Error(`HubSpot: ${message}`), { status });
  const hs: HubspotCall = async <T,>(req: { path: string; method?: string; body?: unknown }): Promise<T> => {
    const method = req.method ?? "GET";
    calls.push({ method, path: req.path, body: req.body as Record<string, unknown> | undefined });
    const failing = o.fail?.[`${method} ${req.path}`];
    if (failing) throw err(failing, failing === 400 ? "Property values were not valid" : "Service unavailable");
    const id = /^\/marketing\/v3\/emails\/(\d+)$/.exec(req.path)?.[1];
    if (method === "GET" && id) { if (!emails[id]) throw err(404, "Not found"); return emails[id] as T; }
    if (method === "POST" && req.path === "/marketing/v3/emails") { const n = String(next++); emails[n] = { id: n, state: "DRAFT", ...(req.body as object) }; return { id: n } as T; }
    if (method === "PATCH" && id) { if (!emails[id]) throw err(404, "Not found"); emails[id] = { ...(emails[id] as object), ...(req.body as object) }; return { id } as T; }
    throw err(400, `the fake HubSpot has no ${method} ${req.path}`);
  };
  return { hs, calls, emails };
}
const deps = { groups: async () => GROUPS, upload: async () => "https://cdn.example.com/up.jpg", urlOf: (id: string) => `https://app-eu1.hubspot.com/email/26492587/edit/${id}/content` };
/** Only drafts: reads, a new draft, an update - never a send, a schedule or a publish. */
const onlyDrafts = (calls: { method: string; path: string }[]) => calls.every((c) => /^\/marketing\/v3\/emails(\/\d+)?$/.test(c.path) && ["GET", "POST", "PATCH"].includes(c.method));

test("which e-mail a language's draft is made from: its own, the campaign's e-mail in that language, or the original - said why", () => {
  const from = { emailId: "100", language: "DE" };
  assert.deepEqual(baseFor(GROUPS, from, "DE"), { id: "100", how: "own", subject: null, why: null });
  assert.deepEqual(baseFor(GROUPS, from, "FR"), { id: "200", how: "language", subject: "Joints sur mesure", why: null });
  assert.equal(baseFor(GROUPS, from, "EN").why, "no EN e-mail of this campaign in HubSpot");
  // a name without its language proves nothing ("Gaskets_NL" is not NL_Gaskets_2611)
  assert.equal(baseFor(GROUPS, from, "NL").how, "original");
  assert.equal(baseFor(null, from, "FR").why, "our e-mails in HubSpot could not be read");
  assert.equal(baseFor(GROUPS, { emailId: "999", language: "DE" }, "FR").why, "the e-mail it was started from is not among our last e-mails in HubSpot");
  // two French e-mails of the campaign: the one sent the same day; else not clear - the original
  const twice = groupEmails([sent("100", "DE_Gaskets_2611", "de", "D"), sent("200", "FR_Gaskets_2611", "fr", "F"), sent("201", "FR_Gaskets_2611", "fr", "F2", "2026-10-01")]);
  assert.equal(baseFor(twice, from, "FR").id, "200");
  const unclear = groupEmails([sent("100", "DE_Gaskets_2611", "de", "D", "2026-11-04"), sent("200", "FR_Gaskets_2611", "fr", "F", "2026-11-05"), sent("201", "FR_Gaskets_2611", "fr", "F2", "2026-11-06")]);
  assert.equal(baseFor(unclear, from, "FR").why, "2 FR e-mails of this campaign - which one is not clear");
  // the e-mail it was started from has no language in its name: nothing is proven
  const plain = groupEmails([sent("100", "Gaskets_2611", "de", "D"), sent("200", "FR_Gaskets_2611", "fr", "F")]);
  assert.equal(baseFor(plain, from, "FR").why, "the e-mail it was started from has no language in its name");
});

test("where each part of the original is in the other language's e-mail: the same widget, or the same place - never guessed", () => {
  const refs = refsOf(newsletter().blocks);
  assert.deepEqual(refs.sort(), ["btn1", "btn2", "hero", "intro", "pic2", "story2"]);
  const m = widgetMap(DE, FR, refs);
  assert.ok("map" in m);
  assert.equal(m.map.intro, "intro");
  // the button HubSpot gave a new id: the same place in the same order of parts
  assert.equal(m.map.btn2, "btn2fr");
  assert.equal(m.byPlace, 1);
  // another order, other ids: no map
  assert.deepEqual(widgetMap(DE, IT, refs), { missing: 6 });
  // another order but the same ids: each by its own id
  const moved: SourceEmail = { ...FR, content: { ...FR.content, flexAreas: { main: { sections: section("web", "intro", "hero", "btn1", "pic2", "story2", "btn2fr", "foot") } } } };
  const m2 = widgetMap(DE, moved, refs);
  assert.deepEqual(m2, { missing: 1 });
});

test("a French draft made from the French e-mail: its frame and settings, the studio's words, its own pictures and addresses where nothing changed", () => {
  const de = newsletter();
  const fr = french(de);
  const m = widgetMap(DE, FR, refsOf(fr.blocks));
  assert.ok("map" in m);
  // the French story's picture changed in the studio; the lead story's not
  const edited = { ...fr, blocks: fr.blocks.map((b): Block => (b.kind === "article" ? { ...b, imageUrl: "https://cdn.example.com/new-two.png" } : b)) };
  const plan = draftFrom(DE, edited, { name: "N (FR)", uploaded: {}, base: { email: FR, map: m.map } });
  const w = (plan.body.content as { widgets: Record<string, { body: Record<string, unknown> }> }).widgets;
  assert.deepEqual(Object.keys(w).sort(), Object.keys(FR.content!.widgets!).sort(), "the French e-mail's parts");
  assert.deepEqual(plan.body.from, FR.from);
  assert.deepEqual(plan.body.subscriptionDetails, FR.subscriptionDetails);
  assert.equal(plan.body.language, "fr");
  assert.match(String(w.intro.body.html), /Des joints au millimètre près - commandés en deux clics/);
  assert.match(String(w.story2.body.html), /Déjà essayé DirectUP/);
  // the lead picture not changed here: the French e-mail's own; the story's changed one goes in
  assert.equal((w.hero.body.img as { src: string }).src, "https://cdn.example.com/fr-hero.png");
  assert.equal((w.pic2.body.img as { src: string }).src, "https://cdn.example.com/new-two.png");
  // the buttons: the studio's words; the addresses not changed here stay the French e-mail's (fr-CH)
  assert.equal(w.btn1.body.text, "ESSAYER MAINTENANT");
  assert.equal(w.btn1.body.destination, "https://www.apsoparts.com/fr-CH/directcut");
  assert.equal(w.btn2fr.body.text, "TÉLÉCHARGER");
  assert.equal(w.btn2fr.body.destination, "https://www.apsoparts.com/fr-CH/directup");
  assert.equal(w.preview_text.body.value, "Deux clics");
  assert.ok(plan.notes.includes("Kept from the FR e-mail (not changed here): 1 picture and 2 links."), plan.notes.join(" | "));
  // a link changed in the studio goes in
  const moved = { ...fr, blocks: fr.blocks.map((b): Block => (b.kind === "hero" ? { ...b, button: { ...b.button, url: "https://www.apsoparts.com/fr-CH/joints" } } : b)) };
  const w2 = (draftFrom(DE, moved, { name: "N", uploaded: {}, base: { email: FR, map: m.map } }).body.content as { widgets: Record<string, { body: Record<string, unknown> }> }).widgets;
  assert.equal(w2.btn1.body.destination, "https://www.apsoparts.com/fr-CH/joints");
});

test("the draft made before: updated while it is a draft in HubSpot - sent, scheduled, in a workflow, deleted or on another template: a new one, said why", () => {
  assert.deepEqual(draftAction(null, null, TEMPLATE), { mode: "new", why: null });
  assert.deepEqual(draftAction("901", { id: 901, state: "DRAFT", content: { templatePath: TEMPLATE } }, TEMPLATE), { mode: "update", id: "901", why: null });
  assert.deepEqual(draftAction("901", { id: 901, state: "DRAFT" }, TEMPLATE), { mode: "update", id: "901", why: null });
  assert.equal(draftAction("901", null, TEMPLATE).why, "Its draft made before (901) is no longer in HubSpot (deleted there) - this is a new draft.");
  assert.match(draftAction("901", { state: "DRAFT", archived: true }).why ?? "", /deleted there/);
  assert.equal(draftAction("901", { state: "PUBLISHED", isPublished: true }).why, "Its draft made before (901) was sent from HubSpot - it stays as it is there; this is a new draft.");
  assert.match(draftAction("901", { state: "SCHEDULED" }).why ?? "", /was scheduled in HubSpot/);
  assert.match(draftAction("901", { state: "AUTOMATED_DRAFT" }).why ?? "", /was put into a workflow in HubSpot/);
  assert.match(draftAction("901", { state: "DRAFT", content: { templatePath: "other.html" } }, TEMPLATE).why ?? "", /another HubSpot template/);
  assert.equal(afterRefusal(400), "new");
  assert.equal(afterRefusal(404), "new");
  assert.equal(afterRefusal(429), "refuse");
  assert.equal(afterRefusal(503), "refuse");
  assert.equal(afterRefusal(403), "refuse");
  assert.equal(statusOf(Object.assign(new Error("x"), { status: 409 })), 409);
  assert.equal(statusOf(new Error("x")), null);
});

test("make, then make again: the same French draft updated in place - never a second one, never sent", async () => {
  const de = newsletter();
  const fr = french(de);
  const h = fakeHubspot();
  const first = await makeDraft(h.hs, fr, "Food - Newsletter (FR)", deps);
  assert.equal(first.made, "new");
  assert.equal(first.id, "900");
  assert.deepEqual(first.base, { id: "200", how: "language", subject: "Joints sur mesure" });
  assert.equal(first.notes[0], "Made from our FR e-mail “Joints sur mesure” - its look, footer and subscription settings.");
  assert.deepEqual(h.calls.map((c) => `${c.method} ${c.path}`), ["GET /marketing/v3/emails/100", "GET /marketing/v3/emails/200", "POST /marketing/v3/emails"]);
  assert.deepEqual((h.emails["900"] as { subscriptionDetails: unknown }).subscriptionDetails, FR.subscriptionDetails);
  // its draft kept in the newsletter; the words changed; made again
  const again = { ...fr, subject: "Joints sur mesure, en deux clics", hubspot: { emailId: first.id, url: first.url, state: "draft", at: "2026-11-11T20:00:00Z", sig: versionSig(fr) } };
  h.calls.length = 0;
  const second = await makeDraft(h.hs, again, "Food - Newsletter (FR)", deps);
  assert.equal(second.made, "updated");
  assert.equal(second.id, "900");
  assert.equal(second.url, "https://app-eu1.hubspot.com/email/26492587/edit/900/content");
  assert.deepEqual(h.calls.map((c) => `${c.method} ${c.path}`), ["GET /marketing/v3/emails/100", "GET /marketing/v3/emails/200", "GET /marketing/v3/emails/900", "PATCH /marketing/v3/emails/900"]);
  const patch = h.calls[3].body!;
  assert.equal(patch.subject, "Joints sur mesure, en deux clics");
  assert.equal("subcategory" in patch, false, "an existing e-mail keeps its kind");
  assert.equal(Object.keys(h.emails).filter((k) => Number(k) >= 900).length, 1, "one draft in HubSpot");
  assert.equal(madeNote(second).split(" - the same e-mail.")[0], "Its draft in HubSpot is updated");
  assert.ok(onlyDrafts(h.calls));
});

test("a draft sent or deleted in HubSpot: a new one, said why; a refusal that is not HubSpot's last word: nothing doubled", async () => {
  const fr = french(newsletter());
  const made = (id: string) => ({ ...fr, hubspot: { emailId: id, url: "", state: "draft", at: "2026-11-11T20:00:00Z" } });
  // sent from HubSpot
  let h = fakeHubspot({ emails: { "901": { id: 901, state: "PUBLISHED", isPublished: true, content: { templatePath: TEMPLATE } } } });
  let r = await makeDraft(h.hs, made("901"), "N", deps);
  assert.equal(r.made, "new");
  assert.equal(r.why, "Its draft made before (901) was sent from HubSpot - it stays as it is there; this is a new draft.");
  assert.ok(madeNote(r).startsWith("Its draft made before (901) was sent"));
  assert.equal(h.calls.filter((c) => c.method === "PATCH").length, 0);
  // deleted in HubSpot (404)
  h = fakeHubspot();
  r = await makeDraft(h.hs, made("777"), "N", deps);
  assert.equal(r.made, "new");
  assert.match(r.why ?? "", /no longer in HubSpot/);
  // HubSpot would not take the update itself: a new draft, said
  h = fakeHubspot({ emails: { "901": { id: 901, state: "DRAFT" } }, fail: { "PATCH /marketing/v3/emails/901": 400 } });
  r = await makeDraft(h.hs, made("901"), "N", deps);
  assert.equal(r.made, "new");
  assert.match(r.why ?? "", /HubSpot did not take the update of its draft made before \(901: Property values were not valid\)/);
  // its side down while updating, or while reading the old draft: refused - no second draft
  h = fakeHubspot({ emails: { "901": { id: 901, state: "DRAFT" } }, fail: { "PATCH /marketing/v3/emails/901": 503 } });
  await assert.rejects(makeDraft(h.hs, made("901"), "N", deps), (e: unknown) => statusOf(e) === 503);
  assert.equal(h.calls.filter((c) => c.method === "POST").length, 0);
  h = fakeHubspot({ emails: { "901": { id: 901, state: "DRAFT" } }, fail: { "GET /marketing/v3/emails/901": 503 } });
  await assert.rejects(makeDraft(h.hs, made("901"), "N", deps));
  assert.equal(h.calls.filter((c) => c.method !== "GET").length, 0);
  assert.ok(onlyDrafts(h.calls));
});

test("no proof of a language's own e-mail: the original's look, and the draft's note says so", async () => {
  const de = newsletter();
  const it = { ...french(de), language: "IT", subject: "Guarnizioni" };
  let h = fakeHubspot();
  let r = await makeDraft(h.hs, it, "N (IT)", deps);
  assert.deepEqual(r.base, { id: "100", how: "original", subject: null });
  assert.equal(r.notes[0], "The IT draft copies the DE e-mail's look, footer and subscription settings (6 of its parts are not in our IT e-mail “Guarnizioni su misura” in the same place) - check its footer in HubSpot.");
  assert.deepEqual((h.emails["900"] as { from: unknown }).from, DE.from);
  // no e-mail of the campaign in that language
  const en = { ...french(de), language: "EN", subject: "Gaskets" };
  h = fakeHubspot();
  r = await makeDraft(h.hs, en, "N (EN)", deps);
  assert.match(r.notes[0], /no EN e-mail of this campaign in HubSpot/);
  // the newsletter's own language: the e-mail it was started from, nothing said
  h = fakeHubspot();
  r = await makeDraft(h.hs, de, "N (DE)", deps);
  assert.deepEqual(r.base, { id: "100", how: "own", subject: null });
  assert.ok(!r.notes.some((n) => /copies the/.test(n)));
  assert.deepEqual(h.calls.map((c) => `${c.method} ${c.path}`), ["GET /marketing/v3/emails/100", "POST /marketing/v3/emails"]);
});

test("translated again, a language keeps its draft; the last step says Update for a draft made before", () => {
  const de = newsletter();
  const fr = { ...french(de), hubspot: { emailId: "900", url: "u", state: "draft", at: "2026-11-11T20:00:00Z", sig: "x" } };
  const doc = withVersion(de, "FR", fr);
  assert.equal(draftOf(doc, "FR")?.emailId, "900");
  assert.equal(draftOf(doc, "IT"), undefined, "a language it has not: no draft - never the newsletter's own");
  assert.equal(translationBase(versionIn(doc, "DE"), "FR", draftOf(doc, "FR")).hubspot?.emailId, "900");
  assert.equal(translationBase(versionIn(doc, "DE"), "IT", draftOf(doc, "IT")).hubspot, undefined);
  const rows = draftRows(doc, null);
  assert.deepEqual(rows.map((r) => [r.lang, r.state]), [["DE", "none"], ["FR", "changed"]]);
  assert.equal(makeAllOf(rows).label, "Make or update 2 drafts (DE, FR)");
  assert.equal(makeAllOf([rows[1]]).label, "Update the FR draft");
  assert.equal(makeAllOf([rows[0]]).label, "Make the DE draft");
});

test("the newsletter's own language changes while it has no other one - the start card's picker; with other languages it stays", () => {
  const de = newsletter();
  const fr = withVersion(de, "DE", { ...versionIn(de, "DE"), language: "FR" });
  assert.equal(fr.language, "FR");
  assert.equal(withVersion(de, "DE", { ...versionIn(de, "DE"), subject: "Neu" }).language, "DE");
  // with a French e-mail of its own: the German one stays German, the French one is kept
  const both = withVersion(de, "FR", french(de));
  const tried = withVersion(both, "DE", { ...versionIn(both, "DE"), language: "IT" });
  assert.equal(tried.language, "DE");
  assert.equal(tried.langs?.FR?.subject, "Joints sur mesure");
});
