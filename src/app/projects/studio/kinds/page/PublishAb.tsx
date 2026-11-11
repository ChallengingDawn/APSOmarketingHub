"use client";
// THE PUBLISHING VIEW'S A/B TEST SECTION (Content v14, SARCLA 11.11.2026: "the A/B test on the publish modal: we need to
// control it from here; this creates a test on the A/B testing platform"). The page's tests in Website > A/B testing >
// Page tests (src/lib/convert/tests.ts, read and controlled through /api/website/ab-testing/pages - the app's own routes
// and rights): each published store view with its A/B state, each test with its status, figures and verdict, and start /
// pause / resume / stop - starting and resuming put a version on the shop, so each is confirmed with what goes live where,
// never by itself. "Create a test from this page" makes AI testing & personalization's version from the Page builder's own
// changes, approves it and makes the test as a draft (POST .../ai-personalization/work {action:"version"}, {action:
// "approve"}, then POST .../ab-testing/pages {action:"create"}) - behind ONE flag (lib .../publishView.ts AB_FROM_PAGE)
// until that release is live; until then the page's tests are matched on its published addresses.

import { isValidElement, useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { convertPost } from "@/app/website/ai-personalization/Flow";
import {
  ConfirmDialog, GatewayNotice, StatusChip, VerdictChip, envChip, n, pagesLine, pct, signed,
  type Confirm, type GatewayView, type TestView,
} from "@/app/website/ai-personalization/TestParts";
import { versionList, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { SHOP_LABEL, abStore, abTestHref, liveOn, type ShopEnv } from "@/lib/content/studio/kinds/page/published";
import {
  AB_FROM_PAGE, AB_FROM_PAGE_WAIT, abActionsOf, abRows, changeWords, testsOfPage, variantChanges, type AbAction, type ChangeLite,
} from "@/lib/content/studio/kinds/page/publishView";
import { PINK, btn, mainBtn } from "../../parts";
import { Choice, Hint, mono } from "./ui";

const API = "/api/website/ab-testing/pages";
const WORK = "/api/website/ai-personalization/work";
const BLUE = "#2459d1";
const testHref = (id: string) => `/website/ab-testing/pages/${encodeURIComponent(id)}`;
type Data = { tests: (TestView & { piece?: number | string | null })[]; gateway: GatewayView; canEdit: boolean };

const ACTION: Record<AbAction, { go: string; title: (t: TestView) => string; tone?: "stop"; first: (t: TestView) => string }> = {
  start: { go: "Start the test", title: () => "Start this test?", first: (t) => `The version goes live on ${t.host} for ${t.allocation.mode === "bandit" ? "a share of the visitors that follows the results" : `${t.allocation.split.b}% of the visitors`} on:` },
  resume: { go: "Resume it", title: () => "Resume this test?", first: (t) => `The version is live again on ${t.host} on:` },
  pause: { go: "Pause it", title: () => "Pause this test?", first: () => "Every visitor sees the page as it is until it is resumed - the figures stay. Its pages:" },
  stop: { go: "Stop it", tone: "stop", title: () => "Stop this test?", first: () => "Every visitor sees the page as it is; the figures stay, and the winner is picked in A/B testing. Its pages:" },
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

export function AbSection({ doc, d, pieceId, title, abPart, prefer, stores }: {
  doc: PageDoc; d: PageDoc; pieceId: number; title: string; abPart?: React.ReactNode;
  /** the store view a test starts on, first (the one worked on, the version's own) */
  prefer: (string | null | undefined)[];
  /** the open version's store views (a test made from this page runs on one of its addresses) */
  stores: string[];
}) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await readJson<Data>(`${API}${AB_FROM_PAGE ? `?piece=${encodeURIComponent(String(pieceId))}` : ""}`);
    setLoading(false);
    if (!r.ok) { setErr(r.error); return; }
    setErr(null);
    setData(r.data);
  }, [pieceId]);
  useEffect(() => { void load(); }, [load]);

  // the page's tests: read by its to-do once the app records it, else the tests on its published addresses
  const tests = useMemo(() => (data ? (AB_FROM_PAGE ? data.tests : testsOfPage(data.tests, doc.magento, pieceId)) : []), [data, doc.magento, pieceId]);
  const rows = useMemo(() => abRows(doc.magento, tests), [doc.magento, tests]);
  const g = data?.gateway ?? null;
  const canAct = !!data?.canEdit && !!g?.configured;

  const ask = (t: TestView, a: AbAction) => setConfirm({
    title: ACTION[a].title(t), go: ACTION[a].go, tone: ACTION[a].tone,
    lines: [ACTION[a].first(t), pagesLine(t.host, t.pages), `"${t.name}" · ${SHOP_LABEL[t.env]}`],
    run: async () => {
      const r = await convertPost<{ id: string; status: string }>(API, { action: a, id: t.id });
      if (!r.ok) { setSaid({ ok: false, text: r.error }); return true; }
      setSaid({ ok: true, text: `"${t.name}" - ${r.data.status === "running" ? "running" : r.data.status}.` });
      await load();
      return true;
    },
  });

  return (
    <Box>
      <Hint mt={0}>A test runs a version of the page against the page as it is, on the shop: the add-to-carts decide. It lives in Website &gt; A/B testing &gt; Page tests - started, paused and stopped from here as there.</Hint>
      {abPart && <Box sx={{ mt: 1.5 }}>{abPart}</Box>}
      {g && <Box sx={{ mt: 1.25 }}><GatewayNotice g={g} what="tests" /></Box>}
      {err && <Typography sx={{ mt: 1.25, fontSize: "0.82rem", color: "#c5221f" }}>{err}</Typography>}

      {/* the page's tests: status, figures, verdict - and their controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2, mb: 0.75 }}>
        <Typography component="div" sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
          The page&apos;s tests · {tests.length}
        </Typography>
        <Button size="small" onClick={() => void load()} disabled={loading} startIcon={loading ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 15 }} />}
          sx={{ ...btn, color: MUTED, px: 0.5, py: 0, fontSize: "0.74rem", minWidth: 0 }}>Read again</Button>
      </Box>
      {loading && !data ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.8rem" }}><CircularProgress size={13} /> Reading A/B testing…</Box>
      ) : !tests.length ? (
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No test runs on this page yet.</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 1 }}>
          {tests.map((t) => <TestCard key={t.id} t={t} canAct={canAct} onAct={(a) => ask(t, a)} />)}
        </Box>
      )}
      {data && !data.canEdit && tests.length > 0 && <Hint mt={0.75}>Starting, pausing and stopping need the write level of Page tests.</Hint>}
      {said && <Typography sx={{ mt: 1, fontSize: "0.78rem", color: said.ok ? "#1b7a55" : "#c5221f" }}>{said.text}</Typography>}

      <MakeTest doc={doc} d={d} pieceId={pieceId} title={title} prefer={prefer} stores={stores} canEdit={!!data?.canEdit} onMade={() => void load()} />
      {/* each published store view with its A/B state */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2.5, mb: 0.75 }}>
        <Typography component="div" sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
          Published store views · {rows.length}
        </Typography>
      </Box>
      {!rows.length ? (
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Not on a shop yet - publish it on ACC first (Pages), then test it here.</Typography>
      ) : (
        <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", overflow: "hidden" }}>
          {[...rows].sort((x, y) => Number(!!y.test) - Number(!!x.test)).map((r, i) => (
            <Box key={`${r.env}|${r.store}`} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 1.25, py: 0.75, borderTop: i ? `1px solid ${HAIRLINE}` : "none" }}>
              <Box sx={{ width: 78, flexShrink: 0 }}>{envChip(r.env)}</Box>
              <Box component="a" href={r.url} target="_blank" rel="noopener noreferrer" title={r.url}
                sx={{ ...mono, fontSize: "0.76rem", color: BLUE, textDecoration: "none", minWidth: 0, flex: "1 1 220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
                {r.path}
              </Box>
              {r.test ? (
                <Box component="a" href={testHref(r.test.id)} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, textDecoration: "none" }}>
                  <StatusChip status={r.test.status} kind="test" />
                  <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.test.name}</Typography>
                </Box>
              ) : (
                <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>No test</Typography>
              )}
              {!r.test && (
                <Button size="small" component="a" href={abTestHref(r.env, r.path, pieceId)} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                  sx={{ ...btn, color: INK, px: 0.75, py: 0, fontSize: "0.74rem", minWidth: 0 }}>Open in A/B testing</Button>
              )}
            </Box>
          ))}
        </Box>
      )}

      <ConfirmDialog c={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}

function TestCard({ t, canAct, onAct }: { t: TestView; canAct: boolean; onAct: (a: AbAction) => void }) {
  const f = t.figures;
  const acts = abActionsOf(t.status);
  return (
    <Box sx={{ p: 1.25, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: "1 1 200px", minWidth: 0 }}>{t.name}</Typography>
        {envChip(t.env)}
        <StatusChip status={t.status} kind="test" />
      </Box>
      <Typography sx={{ mt: 0.25, fontSize: "0.74rem", color: MUTED }}>
        {t.pages.length} page{t.pages.length === 1 ? "" : "s"} on {t.host} · {t.changeCount} change{t.changeCount === 1 ? "" : "s"} in the version
        {t.syncError ? ` · the gateway: ${t.syncError}` : ""}
      </Typography>
      {f?.counted ? (
        <Box sx={{ mt: 0.75, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0,1fr))" }, gap: 1 }}>
          {[
            ["Original", `${pct(f.a.rate, 1)} · ${n(f.a.visitors)} visitors`],
            ["Version", `${pct(f.b.rate, 1)} · ${n(f.b.visitors)} visitors`],
            ["Uplift", signed(f.uplift.mid)],
            ["Days", n(f.days)],
          ].map(([k, v]) => (
            <Box key={k} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED }}>{k}</Typography>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{v}</Typography>
            </Box>
          ))}
        </Box>
      ) : t.status !== "draft" ? (
        <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: MUTED }}>No figures yet - the shop&apos;s gateway has not counted any visitor.</Typography>
      ) : null}
      <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        {f?.verdict && <VerdictChip v={f.verdict} />}
        {f?.verdict?.why && <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED, flex: "1 1 200px", minWidth: 0 }}>{f.verdict.why}</Typography>}
        <Box sx={{ flex: 1 }} />
        {canAct && acts.map((a) => (
          <Button key={a} size="small" variant={a === "start" || a === "resume" ? "contained" : "outlined"} disableElevation onClick={() => onAct(a)}
            sx={a === "start" || a === "resume" ? { ...mainBtn, height: 30, borderRadius: "7px", fontSize: "0.78rem", px: 1.25 } : { ...btn, height: 30, borderRadius: "7px", borderColor: HAIRLINE, color: a === "stop" ? "#c5221f" : INK, fontSize: "0.78rem", px: 1.25 }}>
            {ACTION_LABEL[a]}
          </Button>
        ))}
        <Button size="small" component="a" href={testHref(t.id)} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
          sx={{ ...btn, color: INK, px: 0.75, py: 0, fontSize: "0.76rem", minWidth: 0 }}>Open in A/B testing</Button>
      </Box>
    </Box>
  );
}

/**
 * "Create a test from this page": its variant is the Page builder's other version of the page (B ...) - what it does
 * beyond the version published, which the page on the shop already carries - or, with no other version, the changes the
 * person ticks. A test is made on ACC first, as a draft: nothing reaches the shop until it is started above, confirmed.
 */
function MakeTest({ doc, d, pieceId, title, prefer, stores, canEdit, onMade }: {
  doc: PageDoc; d: PageDoc; pieceId: number; title: string; prefer: (string | null | undefined)[]; stores: string[]; canEdit: boolean; onMade: () => void;
}) {
  const env: ShopEnv = "acc";
  const onAcc = liveOn(doc.magento, env);
  const mine = onAcc.filter((p) => !stores.length || stores.includes(p.store));
  const start = abStore(mine.length ? mine : onAcc, prefer);
  const all = versionList(d);
  const open = d.letter || "A";
  const live = all.find((v) => v.letter === open)?.changes ?? [];
  const others = all.filter((v) => v.letter !== open);
  type From = string; // a letter, or "pick"
  const [from, setFrom] = useState<From>(others[0]?.letter ?? "pick");
  const [picked, setPicked] = useState<number[]>([]);
  const [store, setStore] = useState<string | null>(null);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const at = mine.find((p) => p.store === store) ?? start;
  const changes: ChangeLite[] = from === "pick"
    ? live.filter((_, i) => picked.includes(i)).map((c) => variantChanges([], [c as ChangeLite])[0]).filter(Boolean)
    : variantChanges(live as ChangeLite[], (others.find((v) => v.letter === from)?.changes ?? []) as ChangeLite[]);
  const why = !AB_FROM_PAGE ? AB_FROM_PAGE_WAIT
    : !canEdit ? "Making a test needs the write level of Page tests."
      : !at ? "Publish it on ACC first - a test runs on the page as it is on the shop."
        : !changes.length ? (from === "pick" ? "Tick the changes the version makes." : `Version ${from} does nothing the page on the shop does not do already.`)
          : null;

  const make = async () => {
    if (!at || why) return;
    setSaid(null);
    setBusy("Making the version in AI testing & personalization…");
    const v = await convertPost<{ version: { id: string | number; rev: number; letter?: string } }>(WORK, {
      action: "version", env, path: at.path, changes, title: name.trim() || title, summary: from === "pick" ? `${changes.length} change${changes.length === 1 ? "" : "s"} from the Page builder` : `Version ${from} from the Page builder`, piece: pieceId,
    });
    if (!v.ok) { setBusy(null); setSaid({ ok: false, text: v.error }); return; }
    setBusy("Approving it…");
    const a = await convertPost(WORK, { action: "approve", versionId: v.data.version.id });
    if (!a.ok) { setBusy(null); setSaid({ ok: false, text: a.error }); return; }
    setBusy("Making the test as a draft…");
    const t = await convertPost<{ id: string }>(API, { action: "create", versionId: v.data.version.id, env, pages: [at.path], name: name.trim() || title, piece: pieceId });
    setBusy(null);
    if (!t.ok) { setSaid({ ok: false, text: t.error }); return; }
    setSaid({ ok: true, text: `The test is made as a draft on ACC (#${t.data.id}) - nothing is on the shop until it is started above.` });
    onMade();
  };

  return (
    <Box sx={{ mt: 2, p: 1.25, borderRadius: "10px", border: `1px dashed ${HAIRLINE}`, bgcolor: "#fff" }}>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>Create a test from this page</Typography>
      <Typography sx={{ mt: 0.25, fontSize: "0.76rem", color: MUTED }}>
        {doc.source === "new" && !others.length && !live.length
          ? "A page made here goes to Magento whole: its test needs a version B - its changes against the page on the shop."
          : "The version of the test is what the page builder's other version changes on the page as it is on the shop. Made on ACC first, as a draft."}
      </Typography>
      {AB_FROM_PAGE && (
        <Box sx={{ mt: 1, display: "grid", gap: 1 }}>
          {mine.length > 1 && (
            <Choice label="On" value={at?.store ?? ""} onChange={(s: string) => setStore(s)} options={mine.map((p) => ({ key: p.store, label: p.store }))} />
          )}
          <Choice label="Its version" value={from} onChange={(k: string) => setFrom(k)}
            options={[...others.map((v) => ({ key: v.letter, label: `Version ${v.letter}` })), { key: "pick", label: "Pick the changes", disabled: !live.length }]} />
          {from === "pick" && live.length > 0 && (
            <Box sx={{ display: "grid", gap: 0.4 }}>
              {live.map((c, i) => {
                const on = picked.includes(i);
                return (
                  <Box key={i} component="button" type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== i) : [...p, i]))}
                    sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.78rem", color: INK }}>
                    <Box component="span" sx={{ width: 14, height: 14, borderRadius: "3px", border: `1.5px solid ${on ? BLUE : "#9aa5b8"}`, bgcolor: on ? BLUE : "#fff", display: "grid", placeItems: "center", boxSizing: "border-box", flexShrink: 0 }}>
                      {on && <CheckIcon sx={{ fontSize: 11, color: "#fff" }} />}
                    </Box>
                    <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{changeWords(c as ChangeLite)}</Box>
                  </Box>
                );
              })}
              <Hint mt={0}>Tick only what the page on the shop does not show yet - the test lays it over the page as it is there.</Hint>
            </Box>
          )}
          <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 200 }} sx={{ maxWidth: 460 }} />
        </Box>
      )}
      <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Button size="small" variant="outlined" disabled={!!why || !!busy} onClick={() => void make()}
          startIcon={busy ? <CircularProgress size={12} color="inherit" /> : undefined}
          sx={{ ...btn, height: 34, borderRadius: "8px", borderColor: HAIRLINE, color: PINK }}>
          {busy ?? "Create a test from this page"}
        </Button>
        {why && <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED }}>{why}</Typography>}
        {AB_FROM_PAGE && at && !why && <Typography component="span" sx={{ ...mono, fontSize: "0.72rem", color: MUTED }}>{at.path} · {changes.length} change{changes.length === 1 ? "" : "s"}</Typography>}
      </Box>
      {said && <Typography sx={{ mt: 0.75, fontSize: "0.78rem", color: said.ok ? "#1b7a55" : "#c5221f" }}>{said.text}</Typography>}
    </Box>
  );
}
