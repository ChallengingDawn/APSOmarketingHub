"use client";
// THE PUBLISHING VIEW'S A/B TEST SECTION, IN THREE STEPS (Content v15, SARCLA 11.11.2026, ~18:00: "I cannot define the
// test. I should be able in one click to create, with the same content, another version to send, and then it sends to AI
// personalization - this should send to the A/B testing sub app, but always be tracked from the page as well, on its tab.
// Needs also to behave more featured and straightforward.")
//   1  Version B   "Make version B (a copy of this page)": the page builder's own versions (lib .../model.ts addVersion -
//                  a page made here keeps each version's blocks and words since v15), B opened on the stage to be changed;
//                  a line says what B changes (lib .../abFlow.ts blocksChanged; a page of the shop: its changes beyond A's);
//                  one click back to A
//   2  The test    one card, its defaults filled in (abFlow.ts testDefaults): its name, what decides (add to cart - what A/B
//                  testing counts), who sees it, the split, where (ACC first). "Send to A/B testing": B's change list
//                  (the studio's ab_variant), AI testing & personalization's version from it, approved, then the test as a
//                  DRAFT linked to this to-do (POST .../ai-personalization/work {action:"version"}, {action:"approve"}; POST
//                  .../ab-testing/pages {action:"create", piece}) - nothing on the shop until it is started, confirmed
//   3  Tracked     each test of this page (GET .../ab-testing/pages?piece=): its status, days, visitors and add-to-carts of
//                  A and B, the uplift with its range, the verdict in plain words, its day-by-day line (GET .../<id>); and
//                  Start / Pause / Resume / Stop, "Make B the page" (the winner: B's content becomes version A, written by
//                  Update on ACC, then production), "Open in A/B testing" - every one that changes the shop confirmed.

import { isValidElement, useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { convertPost } from "@/app/website/ai-personalization/Flow";
import {
  ConfirmDialog, GatewayNotice, StatusChip, VerdictChip, envChip, n, pagesLine,
  type Confirm, type GatewayView, type TestView,
} from "@/app/website/ai-personalization/TestParts";
import { addVersion, openVersion, promoteVersion, versionList, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { SHOP_LABEL, abTestHref, liveOn } from "@/lib/content/studio/kinds/page/published";
import { AB_FROM_PAGE, abActionsOf, abRows, changeWords, isOwnTest, pageTestsQuery, testsOfPage, variantChanges, type AbAction, type ChangeLite } from "@/lib/content/studio/kinds/page/publishView";
import {
  allocationOf, armLetterOf, audienceOf, blocksChanged, differsLine, flowStep, needsDecide, sendWhy, sparkPoints, testDefaults, upliftLine, withWon, type AbEnv, type SplitKey, type TestDraft,
} from "@/lib/content/studio/kinds/page/abFlow";
import { PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Choice, Hint, mono } from "./ui";

const API = "/api/website/ab-testing/pages";
const WORK = "/api/website/ai-personalization/work";
const BLUE = "#2459d1";
const GREEN = "#1b7a55";
const RED = "#c5221f";
const testHref = (id: string) => `/website/ab-testing/pages/${encodeURIComponent(id)}`;
type Data = { tests: (TestView & { piece?: number | string | null })[]; gateway: GatewayView; canEdit: boolean };
type Daily = { rateA: number | null; rateB: number | null }[];

const ACTION: Record<AbAction, { go: string; title: string; tone?: "stop"; first: (t: TestView) => string }> = {
  start: { go: "Start the test", title: "Start this test?", first: (t) => `Version B goes live on ${t.host} for ${t.allocation.mode === "bandit" ? "a share of the visitors that follows the results (each side keeps at least 10%)" : `${t.allocation.split.b}% of the visitors`} on:` },
  resume: { go: "Resume it", title: "Resume this test?", first: (t) => `Version B is live again on ${t.host} on:` },
  pause: { go: "Pause it", title: "Pause this test?", first: () => "Every visitor sees the page as it is until it is resumed - the figures stay. Its pages:" },
  stop: { go: "Stop it", tone: "stop", title: "Stop this test?", first: () => "Every visitor sees the page as it is; the figures stay. Its pages:" },
};
const ACTION_LABEL: Record<AbAction, string> = { start: "Start", resume: "Resume", pause: "Pause", stop: "Stop" };

/** Which A/B test pass `abPart`'s `lit` last opened (the top bar's "Set it up"): kept across the step's mounts. */
let seenAbLit = 0;
/** The top bar opened the last step on the A/B test (Studio's openAbStep lights `abPart`): true when it opened the step,
 * and `onLit` each time it does so while the step is open. */
export function useAbLit(abPart: React.ReactNode, onLit: () => void): boolean {
  const lit = isValidElement<{ lit?: number }>(abPart) ? abPart.props.lit ?? 0 : 0;
  const [first] = useState(() => lit > seenAbLit);
  useEffect(() => {
    if (lit > seenAbLit) { seenAbLit = lit; onLit(); }
    // once per light (onLit is a new function at each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit]);
  return first;
}

async function readJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const text = (await r.text()).trim();
    let j: { ok?: boolean; data?: T; error?: string };
    try { j = JSON.parse(text); } catch { return { ok: false, error: `The hub answered ${r.status}.` }; }
    if (r.status === 403) return { ok: false, error: "You have no access to Website > A/B testing - ask an admin for it." };
    if (j.ok) return { ok: true, data: j.data as T };
    return { ok: false, error: j.error ?? `The hub answered ${r.status}.` };
  } catch (e) {
    return { ok: false, error: `No answer: ${(e as Error).message}` };
  }
}

/** A step's card: its number, its title, lit when it is the one to do. */
function StepCard({ n: num, title, now, done, children, right }: { n: number; title: string; now: boolean; done?: boolean; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: "12px", border: `1px solid ${now ? "rgba(194,44,110,.45)" : HAIRLINE}`, bgcolor: "#fff", boxShadow: now ? "0 0 0 3px rgba(194,44,110,.08)" : "none" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box component="span" sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, fontSize: "0.74rem", fontWeight: 800,
          color: done ? "#fff" : now ? "#fff" : MUTED, bgcolor: done ? GREEN : now ? PINK : "rgba(21,34,58,.07)" }}>
          {done ? <CheckIcon sx={{ fontSize: 14 }} /> : num}
        </Box>
        <Typography sx={{ flex: 1, fontSize: "0.9rem", fontWeight: 800, color: INK }}>{title}</Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "130px minmax(0,1fr)" }, columnGap: 1.5, rowGap: 0.5, alignItems: "center", py: 0.6 }}>
    <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
    <Box sx={{ minWidth: 0 }}>{children}</Box>
  </Box>
);

export function AbSection({ api, doc, d, setView, lang, pieceId, title, abPart, prefer, stores, canEditPage, onPromoted }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; setView: (next: PageDoc) => void; lang: string; pieceId: number; title: string; abPart?: React.ReactNode;
  /** the store view a test link opens first (the one worked on, the version's own) */
  prefer: (string | null | undefined)[];
  /** the open language's store views (who sees the test, by default) */
  stores: string[];
  canEditPage: boolean;
  /** B became the page: the publishing view shows Pages, to update ACC, then production */
  onPromoted: () => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  // every test of the to-do OR on a page it is published on (dev-eb's page filter, 14.11.2026) - in one query
  const query = useMemo(() => (AB_FROM_PAGE ? pageTestsQuery(pieceId, doc.magento) : ""), [pieceId, doc.magento]);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await readJson<Data>(`${API}${query}`);
    setLoading(false);
    if (!r.ok) { setErr(r.error); return; }
    setErr(null);
    setData(r.data);
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  // the page's tests: read by its to-do (the app records it), else the tests on its published addresses
  const tests = useMemo(() => (data ? (AB_FROM_PAGE ? data.tests : testsOfPage(data.tests, doc.magento, pieceId)) : []), [data, doc.magento, pieceId]);
  const rows = useMemo(() => abRows(doc.magento, tests), [doc.magento, tests]);
  const g = data?.gateway ?? null;
  const canAct = !!data?.canEdit && !!g?.configured;

  /* ── step 1: version B ── */
  const isNew = d.source === "new";
  const all = versionList(d);
  const open = d.letter || "A";
  const others = all.filter((v) => v.letter !== "A");
  const [letter, setLetter] = useState<string>(others[0]?.letter ?? "B");
  const hasB = all.some((v) => v.letter === letter) && all.some((v) => v.letter === "A");
  const aView = hasB ? openVersion(d, "A") : d;
  const bView = hasB ? openVersion(d, letter) : null;
  const changed = useMemo(() => {
    if (!bView) return [];
    if (isNew) return blocksChanged(aView.fields, bView.fields);
    return variantChanges(aView.changes as ChangeLite[], bView.changes as ChangeLite[]).map(changeWords);
  }, [aView, bView, isNew]);
  const makeB = () => {
    // the next free letter is B on a page with A alone; the copy opens on the stage, to be changed
    const next = addVersion(d);
    if (next === d) return;
    setLetter(next.letter);
    setView(next);
  };

  /* ── step 2: the test ── */
  const [draft, setDraft] = useState<TestDraft>(() => testDefaults({ page: title, letter, changed, stores }));
  const [named, setNamed] = useState(false);
  // the name follows what B changes until the person writes one
  const autoName = testDefaults({ page: title, letter, changed, stores }).name;
  useEffect(() => { if (!named) setDraft((x) => ({ ...x, name: autoName })); }, [autoName, named]);
  useEffect(() => { setDraft((x) => (x.stores.join() === stores.join() ? x : { ...x, stores: [...stores] })); }, [stores]);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // this language's pages on each shop: where its test runs
  const here = (env: AbEnv) => liveOn(doc.magento, env).filter((p) => !stores.length || stores.includes(p.store));
  const where = here(draft.env);
  const startPage = prefer.map((s) => where.find((p) => p.store === s)).find(Boolean) ?? where[0] ?? null;
  const why = !hasB ? "Make version B first (step 1)." : sendWhy({ canEdit: !!data?.canEdit, changes: changed.length, onShop: { acc: here("acc").length > 0, prod: here("prod").length > 0 }, env: draft.env, name: draft.name, sending: !!sending });

  const send = async () => {
    if (why || !startPage) return;
    setSaid(null);
    setSending("Reading version B as the shop will get it…");
    const v = await api.act<{ changes: ChangeLite[]; size: number; path: string | null }>("ab_variant", { lang, letter, env: draft.env });
    if (!v.ok) { setSending(null); setSaid({ ok: false, text: v.error }); return; }
    if (!v.result.changes.length) { setSending(null); setSaid({ ok: false, text: `Version ${letter} does nothing the page on the shop does not do already.` }); return; }
    setSending("Making the version in AI testing & personalization…");
    const made = await convertPost<{ version: { id: string | number; rev: number } }>(WORK, {
      action: "version", env: draft.env, path: startPage.path, changes: v.result.changes, title: draft.name.trim(), summary: changed.length ? `Version ${letter} from the Page builder: ${changed.join(", ")}` : `Version ${letter} from the Page builder`, piece: pieceId,
      // each letter its own version in A/B testing (dev-eb 13.11): B then C never revise one version - an older test of B
      // keeps running B
      letter,
    });
    if (!made.ok) { setSending(null); setSaid({ ok: false, text: made.error }); return; }
    const versionId = String(made.data.version.id);
    setSending("Approving it…");
    const ok = await convertPost(WORK, { action: "approve", versionId });
    if (!ok.ok) { setSending(null); setSaid({ ok: false, text: ok.error }); return; }
    setSending("Making the test in A/B testing…");
    const pages = draft.who === "stores" ? where.map((p) => p.path) : [startPage.path];
    const t = await convertPost<{ id: string }>(API, {
      action: "create", versionId, env: draft.env, pages: [...new Set([startPage.path, ...pages])].slice(0, 20), name: draft.name.trim(),
      allocation: allocationOf(draft.split), audience: audienceOf(draft), piece: pieceId,
    });
    setSending(null);
    if (!t.ok) { setSaid({ ok: false, text: t.error }); return; }
    setSent(true);
    setSaid({ ok: true, text: `Sent to A/B testing as a draft (#${t.data.id}) - nothing is on the shop until you start it below.` });
    await load();
  };

  /* ── step 3: the tests, tracked here ── */
  const ask = (t: TestView, a: AbAction) => setConfirm({
    title: ACTION[a].title, go: ACTION[a].go, tone: ACTION[a].tone,
    lines: [ACTION[a].first(t), pagesLine(t.host, t.pages), `"${t.name}" · ${SHOP_LABEL[t.env]}`],
    run: async () => {
      const r = await convertPost<{ id: string; status: string }>(API, { action: a, id: t.id });
      setSaid(r.ok ? { ok: true, text: `"${t.name}" - ${r.data.status}.` } : { ok: false, text: r.error });
      await load();
      return true;
    },
  });
  // the letter each test's version arm is (A/B testing's origin.letter - never the letter open here, dev-eb 13.11)
  const letters = all.map((v) => v.letter);
  // a test of this page made elsewhere (another to-do, A/B testing itself): its version is none of this page's letters
  const armOf = (t: TestView) => (isOwnTest(t, pieceId) ? armLetterOf(t.origin, letters) : null);
  const makeBThePage = (t: TestView, L: string) => setConfirm({
    title: `Make ${L} the page?`, go: `Make ${L} the page`,
    lines: [
      `The test stops and ${L} is recorded as its winner in A/B testing. ${L}'s content becomes the page's version A here - A as it was is replaced.`,
      "Nothing is written to the shop yet: Pages then shows the page changed - Update all on ACC, look at it there, then production. Production written closes the test in A/B testing as published.",
      `"${t.name}" · ${SHOP_LABEL[t.env]}`,
    ],
    run: async () => {
      if (needsDecide(t)) {
        const r = await convertPost(API, { action: "decide", id: t.id, winner: "b" });
        if (!r.ok) { setSaid({ ok: false, text: r.error }); return true; }
      }
      const me = api.data.me ?? "";
      setView({ ...promoteVersion(d, L), abWon: withWon(d.abWon, { testId: t.id, letter: L, view: lang, at: new Date().toISOString(), by: me }) });
      setSaid({ ok: true, text: `${L} is the page now - update it on ACC, then production, from Pages. Production written closes "${t.name}" in A/B testing.` });
      await load();
      onPromoted();
      return true;
    },
  });

  const step = flowStep({ hasB, changed: changed.length, tests });
  const counts = `${tests.length} test${tests.length === 1 ? "" : "s"}`;

  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Hint mt={0}>Test a version B of this page against the page as it is, on the shop - the add-to-carts decide. The test runs in A/B testing and is followed here.</Hint>
      {g && <GatewayNotice g={g} what="tests" />}
      {err && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{err}</Typography>}

      {/* 1 - version B in one click */}
      <StepCard n={1} title="Version B" now={step === "make" || step === "change"} done={hasB && changed.length > 0}>
        {!hasB ? (
          <>
            <Button variant="contained" disableElevation disabled={!canEditPage} onClick={makeB} startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
              sx={{ ...mainBtn, height: 38, borderRadius: "8px", px: 2 }}>Make version B (a copy of this page)</Button>
            <Typography sx={{ mt: 0.75, fontSize: "0.78rem", color: MUTED }}>B starts as the same page and opens on the stage - change what you want to test there: a headline, the hero, a block.</Typography>
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Choice value={open} onChange={(k: string) => setView(openVersion(d, k))} options={all.map((v) => ({ key: v.letter, label: v.letter === "A" ? "A - the page" : `${v.letter} - to test` }))} />
              {open !== "A" && <Typography component="span" sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 700 }}>{open} is open on the stage - what you change now changes {open}.</Typography>}
            </Box>
            <Typography sx={{ mt: 0.75, fontSize: "0.8rem", color: changed.length ? INK : MUTED, fontWeight: changed.length ? 600 : 400 }}>{differsLine(changed, letter)}</Typography>
            {open !== "A" && <Typography sx={{ mt: 0.4, fontSize: "0.74rem", color: MUTED }}>Pages writes the version open - open A again before you update the page itself.</Typography>}
          </>
        )}
      </StepCard>

      {/* 2 - the test, defined on one card */}
      <StepCard n={2} title="Define the test" now={step === "define"} done={sent}>
        <Row label="Name">
          <TextField size="small" fullWidth value={draft.name} onChange={(e) => { setNamed(true); setDraft((x) => ({ ...x, name: e.target.value })); }} inputProps={{ maxLength: 200 }}
            sx={{ "& .MuiInputBase-input": { fontSize: "0.84rem" } }} />
        </Row>
        <Row label="What decides">
          <Typography sx={{ fontSize: "0.82rem", color: INK }}><b>Add to cart</b> on the page - the share of visitors who add something to the cart, A against B</Typography>
        </Row>
        <Row label="Who sees it">
          <Choice value={draft.who} onChange={(k: "all" | "stores") => setDraft((x) => ({ ...x, who: k }))}
            options={[{ key: "stores", label: `This language's store views (${stores.length})` }, { key: "all", label: "All visitors" }]} />
          {draft.who === "stores" && <Typography sx={{ mt: 0.4, ...mono, fontSize: "0.7rem", color: MUTED }}>{stores.join(" · ")}</Typography>}
        </Row>
        <Row label="The split">
          <Choice value={draft.split} onChange={(k: SplitKey) => setDraft((x) => ({ ...x, split: k }))}
            options={[{ key: "half", label: "Half and half" }, { key: "bandit", label: "More to the better one, automatically" }]} />
          <Typography sx={{ mt: 0.4, fontSize: "0.72rem", color: MUTED }}>
            {draft.split === "bandit" ? "Starts half and half; the shop's gateway then sends more visitors to the version doing better - each keeps at least 10%." : "Each visitor keeps the version they got."}
          </Typography>
        </Row>
        <Row label="Where">
          <Choice value={draft.env} onChange={(k: AbEnv) => setDraft((x) => ({ ...x, env: k }))}
            options={[{ key: "acc", label: "ACC first" }, { key: "prod", label: "Production", disabled: !here("prod").length }]} />
        </Row>
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button variant={step === "define" ? "contained" : "outlined"} disableElevation disabled={!!why} onClick={() => void send()}
            startIcon={sending ? <CircularProgress size={13} color="inherit" /> : <SendOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={step === "define" ? { ...mainBtn, height: 38, borderRadius: "8px", px: 2 } : { ...btn, height: 38, borderRadius: "8px", borderColor: HAIRLINE, color: INK }}>
            {sending ?? "Send to A/B testing"}
          </Button>
          {why && !sending && <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}>{why}</Typography>}
          {!why && startPage && <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>As a draft, on {SHOP_LABEL[draft.env]} - started only by you, below.</Typography>}
        </Box>
      </StepCard>

      {/* 3 - tracked here */}
      <StepCard n={3} title="Tracked here" now={step === "track"} right={(
        <Button size="small" onClick={() => void load()} disabled={loading} startIcon={loading ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 15 }} />}
          sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0 }}>{counts} · Read again</Button>
      )}>
        {loading && !data ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.8rem" }}><CircularProgress size={13} /> Reading A/B testing…</Box>
        ) : !tests.length ? (
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No test of this page yet - send one above.</Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 1 }}>
            {tests.map((t) => {
              const L = armOf(t);
              const waiting = doc.abWon.find((m) => m.testId === t.id) ?? null;
              return <TestCard key={t.id} t={t} canAct={canAct} canPromote={!!L && letters.includes(L) && canEditPage && !!data?.canEdit && !waiting} letter={L} waiting={!!waiting} own={isOwnTest(t, pieceId)}
                onAct={(a) => ask(t, a)} onPromote={() => L && makeBThePage(t, L)} />;
            })}
          </Box>
        )}
        {data && !data.canEdit && tests.length > 0 && <Hint mt={0.75}>Starting, pausing and stopping need the write level of A/B testing &gt; Page tests.</Hint>}
      </StepCard>
      {said && <Typography sx={{ fontSize: "0.8rem", color: said.ok ? GREEN : RED }}>{said.text}</Typography>}

      {/* the page's published store views, each with its test - or a link to A/B testing for it */}
      <Box>
        <Typography component="div" sx={{ mt: 0.5, mb: 0.75, fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
          Published store views · {rows.length}
        </Typography>
        {!rows.length ? (
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Not on a shop yet - publish it on ACC first (Pages), then test it here.</Typography>
        ) : (
          <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
            {[...rows].sort((x, y) => Number(!!y.test) - Number(!!x.test)).map((r, i) => (
              <Box key={`${r.env}|${r.store}`} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 1.25, py: 0.6, borderTop: i ? `1px solid ${HAIRLINE}` : "none" }}>
                <Box sx={{ width: 78, flexShrink: 0 }}>{envChip(r.env)}</Box>
                <Box component="a" href={r.url} target="_blank" rel="noopener noreferrer" title={r.url}
                  sx={{ ...mono, fontSize: "0.74rem", color: BLUE, textDecoration: "none", minWidth: 0, flex: "1 1 200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>{r.path}</Box>
                {r.test ? <StatusChip status={r.test.status} kind="test" /> : (
                  <Button size="small" component="a" href={abTestHref(r.env, r.path, pieceId)} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                    sx={{ ...btn, color: INK, px: 0.75, py: 0, fontSize: "0.74rem", minWidth: 0 }}>Open in A/B testing</Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
      {abPart}
      <ConfirmDialog c={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}

/** A test of the page, followed here: its status and days, A and B side by side, the uplift with its range, the verdict
 * in plain words, the day-by-day line - and what may be done with it. */
function TestCard({ t, canAct, canPromote, letter: L, waiting, own, onAct, onPromote }: {
  /** `letter`: the page's letter its version arm is (armLetterOf), null for an older test whose letter is not known;
   * `own`: made from this to-do (else a test of the same page made elsewhere, followed here) */
  t: TestView; canAct: boolean; canPromote: boolean; letter: string | null; waiting: boolean; own: boolean; onAct: (a: AbAction) => void; onPromote: () => void;
}) {
  const letter = L ?? "The version";
  const f = t.figures;
  const acts = abActionsOf(t.status);
  const [daily, setDaily] = useState<Daily | null>(null);
  useEffect(() => {
    if (t.status === "draft") return;
    let gone = false;
    void readJson<{ analysis?: { daily?: Daily } | null }>(`${API}/${encodeURIComponent(t.id)}`).then((r) => { if (!gone && r.ok) setDaily(r.data.analysis?.daily ?? null); });
    return () => { gone = true; };
  }, [t.id, t.status]);
  const spark = daily ? sparkPoints(daily) : null;
  const won = f?.verdict?.key === "b-wins";
  return (
    <Box sx={{ p: 1.25, borderRadius: "10px", border: `1px solid ${won ? "rgba(27,122,85,.4)" : HAIRLINE}`, bgcolor: won ? "rgba(27,122,85,.03)" : "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: "1 1 200px", minWidth: 0 }}>{t.name}</Typography>
        {envChip(t.env)}
        <StatusChip status={t.status} kind="test" />
      </Box>
      <Typography sx={{ mt: 0.25, fontSize: "0.74rem", color: MUTED }}>
        {t.status === "draft" ? "A draft - nothing on the shop until it is started." : `${n(f?.days ?? 0)} day${f?.days === 1 ? "" : "s"}`} · {t.pages.length} page{t.pages.length === 1 ? "" : "s"} on {t.host} · {t.allocation.mode === "bandit" ? "more to the better one" : "half and half"}
        {t.syncError ? ` · the gateway: ${t.syncError}` : ""}
      </Typography>
      {f?.counted && (
        <>
          <Box sx={{ mt: 0.75, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            {([["A - the page", f.a], [L ? `${L} - the version` : "The version", f.b]] as const).map(([k, arm]) => (
              <Box key={k} sx={{ minWidth: 0, p: 0.75, borderRadius: "8px", bgcolor: "#f6f8fb" }}>
                <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED }}>{k}</Typography>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{arm.rate === null ? "–" : `${(arm.rate * 100).toFixed(1)}%`} add to cart</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{n(arm.carts)} add-to-carts of {n(arm.visitors)} visitors</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ flex: "1 1 220px", minWidth: 0, fontSize: "0.8rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{upliftLine(f)}</Typography>
            {spark && spark.a && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box component="svg" viewBox="0 0 160 36" sx={{ width: 160, height: 36, display: "block" }} aria-label="The add-to-cart rate day by day, A and B">
                  <polyline points={spark.a} fill="none" stroke="#7d8aa3" strokeWidth={1.6} />
                  <polyline points={spark.b} fill="none" stroke={PINK} strokeWidth={2} />
                </Box>
                <Typography component="span" sx={{ fontSize: "0.68rem", color: MUTED, lineHeight: 1.3 }}>day by day<br /><Box component="span" sx={{ color: PINK, fontWeight: 700 }}>{L ?? "version"}</Box> · <Box component="span" sx={{ color: "#7d8aa3", fontWeight: 700 }}>A</Box></Typography>
              </Box>
            )}
          </Box>
        </>
      )}
      {f && !f.counted && t.status !== "draft" && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: MUTED }}>No visitor counted yet.</Typography>}
      {waiting && t.status !== "shipped" && (
        <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: GREEN, fontWeight: 600 }}>
          {letter} is the page here - Update all on production in Pages, and this test is closed in A/B testing as published.
        </Typography>
      )}
      {!own && (
        <Typography sx={{ mt: 0.5, fontSize: "0.74rem", color: MUTED }}>
          Made {t.origin?.todo ? `in the to-do «${t.origin.todo.title}»` : "in A/B testing"} - followed here because it runs on this page; its winner is made the page there.
        </Typography>
      )}
      {own && !L && t.status !== "draft" && t.status !== "shipped" && (
        <Typography sx={{ mt: 0.5, fontSize: "0.74rem", color: MUTED }}>Made before A/B testing kept each version&apos;s letter - its winner is made the page from A/B testing, or test it again from here.</Typography>
      )}
      <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        {f?.verdict && <VerdictChip v={f.verdict} />}
        {f?.verdict?.why && <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED, flex: "1 1 200px", minWidth: 0 }}>{f.verdict.why}</Typography>}
        <Box sx={{ flex: 1 }} />
        {canAct && acts.map((a) => (
          <Button key={a} size="small" variant={a === "start" || a === "resume" ? "contained" : "outlined"} disableElevation onClick={() => onAct(a)}
            sx={a === "start" || a === "resume" ? { ...mainBtn, height: 30, borderRadius: "7px", fontSize: "0.78rem", px: 1.25 } : { ...btn, height: 30, borderRadius: "7px", borderColor: HAIRLINE, color: a === "stop" ? RED : INK, fontSize: "0.78rem", px: 1.25 }}>
            {ACTION_LABEL[a]}
          </Button>
        ))}
        {canPromote && t.status !== "draft" && t.status !== "shipped" && (
          <Button size="small" variant={won ? "contained" : "outlined"} disableElevation onClick={onPromote}
            sx={won ? { ...btn, height: 30, borderRadius: "7px", fontSize: "0.78rem", px: 1.25, bgcolor: GREEN, color: "#fff", "&:hover": { bgcolor: "#15603f" } } : { ...btn, height: 30, borderRadius: "7px", borderColor: HAIRLINE, color: GREEN, fontSize: "0.78rem", px: 1.25 }}>
            Make {letter} the page
          </Button>
        )}
        <Button size="small" component="a" href={testHref(t.id)} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
          sx={{ ...btn, color: INK, px: 0.75, py: 0, fontSize: "0.76rem", minWidth: 0 }}>Open in A/B testing</Button>
      </Box>
    </Box>
  );
}
