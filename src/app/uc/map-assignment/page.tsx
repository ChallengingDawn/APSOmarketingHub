"use client";

// MAP ASSIGNMENT - a HubSpot app (UC & HubSpot Apps > HubSpot apps). SARCLA 19.10.2026: "an interactive map with the
// region per person ... that we can automate and change ... per country". Who owns a company is decided in the hub,
// country by country, by the Performis SAE or by postcode zones on a map (France: Jeremy Borey for Auvergne-Rhône-Alpes
// and Bourgogne-Franche-Comté only); key accounts first; the contacts follow their company. Shadow (compare) or live
// (write) per country. The engine is src/lib/mapAssign; this page reads GET /api/uc/map-assignment.
// v3, SARCLA 20.10.2026: "the map should be big", "these two bars are too much", "only the map - options and KPIs
// appear in a side panel", Rules and Performis "merged in one simpler map". So: ONE bar (the views, and Save on its
// right), the Map at the screen's height with Options / KPIs / a clicked place in a panel on its left; Differences
// (moves by person), No company, Redirections (Owner redirection, with the rules that work against the map to accept
// or decline), Live (per country, or all at once).
// 21.10.2026 (SARCLA): Differences became Contacts - the new contacts of the last 30 days against the rules, how every
// contact matches its company, and the differences by topic folded under them (old #differences links open it).
// Edits show on the map before they are saved; one Save sends them, a patch per part.
// 24.10.2026 (SARCLA): "on top of the page a Sandbox / Live toggle so the sales leader can play around and do tests on
// regions ... always the comparing KPIs, to measure the result with one ESO less, the km², the money, everything; then
// they create a model we bring back on the main one - this should not in any way be automatic, the human needs to push
// the button". So: Live | Sandbox top right. The sandbox is a second set of rules (a copy of live until changed) that
// everyone who can open the page may change - it saves itself and never decides, writes or touches HubSpot; the map and
// the KPIs show what it would give, each KPI with its difference to live. A bar names the parts that differ from live;
// an admin brings a part to live with a button (that part of the live rules replaced, every company decided again).
// The map's KPIs button opens the Rules window on KPI (it opened the old side panel).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { INK, MUTED, RED } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Info, when } from "@/app/connectors/parts";
import type { AssignRules } from "@/lib/mapAssign/rules";
import type { MapData } from "@/lib/mapAssign/api";
import { CountryPicker, MapPanel, useCountryMap } from "./MapPanel";
import { RulesDialog, type Compare, type Mode, type Place } from "./RulesDialog";
import { ContactsView, followPct, useContactsData } from "./ContactsView";
import { NoCompanyView } from "./NoCompanyView";
import { LiveView } from "./LiveView";
import { SaeTableView } from "./SaeTableView";
import { WrongPerformisView } from "./WrongPerformisView";
import { DomainsView } from "./DomainsView";
import {
  API, OLD_VIEW_HASH, VIEW_HASH, assignInto, buildPalette, canon, checkRules, countryList, countryName, namesOf, partName, rulesParts, saveRules, send,
  type Names, type Palette, type SetDraft, type View,
} from "./shared";

const CC_KEY = "apsomh:map-assignment:country";
const SPACE_KEY = "apsomh:map-assignment:space";
type Space = "live" | "sandbox";
/** The views' hashes, and the old ones that still open a view. */
const TAB_HASH = { ...VIEW_HASH, ...OLD_VIEW_HASH };

const VIEW_LABEL: Record<View, string> = {
  map: "Map", sae: "SAE table", performis: "Wrong Performis Owners", contacts: "Contacts", nocompany: "No company", domains: "Domains", live: "Live",
};

function MapView({ d, rules, setDraft, cc, setCc, names, palette, dirty, rev, n, busy, check, msg, onSave, onUndo, seededNow, onSeeded, sandbox, liveRules }: {
  d: MapData; rules: AssignRules; setDraft: SetDraft; cc: string; setCc: (cc: string) => void; names: Names; palette: Palette; dirty: boolean;
  rev: number; n: number; busy: boolean; check: { errors: string[] }; msg: { ok: boolean; text: string } | null; onSave: () => void; onUndo: () => void;
  seededNow: boolean; onSeeded: () => void;
  /** the sandbox's version (null = live): the map and the KPIs show the sandbox, compared with the live rules */
  sandbox: string | null; liveRules: AssignRules;
}) {
  const m = useCountryMap(cc, rules, sandbox !== null ? liveRules : d.rules, sandbox !== null ? canon(rules) !== canon(liveRules) : dirty);
  const liveM = useCountryMap(cc, liveRules, liveRules, false);
  const onAssign = useMemo(() => assignInto(setDraft), [setDraft]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("rules");
  const [place, setPlace] = useState<Place | null>(null);
  useEffect(() => { setPlace(null); }, [cc]);
  const compare: Compare | null = useMemo(() => (sandbox !== null ? { sandbox, live: { m: liveM, rules: liveRules } } : null), [sandbox, liveM, liveRules]);
  return (
    <>
      <MapPanel m={m} cc={cc} rules={rules} d={d} names={names} palette={palette} onAssign={onAssign} setDraft={setDraft} sandbox={sandbox}
        top={<CountryPicker list={countryList(d, rules)} cc={cc} onPick={setCc} />} onRules={() => { setPlace(null); setMode("rules"); setRulesOpen(true); }}
        onKpi={() => { setPlace(null); setMode("kpi"); setRulesOpen(true); }}
        onPlace={(p) => { setPlace(p); setMode("rules"); setRulesOpen(true); }} />
      <RulesDialog open={rulesOpen} onClose={() => { setRulesOpen(false); setPlace(null); }} place={place} onWholeCountry={() => setPlace(null)} cc={cc} setCc={setCc} d={d} rules={rules} setDraft={setDraft} names={names} palette={palette}
        rev={rev} m={m} n={n} dirty={dirty} busy={busy} check={check} msg={msg} onSave={onSave} onUndo={onUndo}
        seededNow={seededNow} onSeeded={onSeeded} mode={mode} setMode={setMode} compare={compare} />
    </>
  );
}

/** Live or Sandbox, top right - big enough to see (SARCLA 24.10.2026: "on top of the page a Sandbox / Live toggle"). */
function SpaceSwitch({ space, setSpace }: { space: Space; setSpace: (s: Space) => void }) {
  const btn = (s: Space, label: string, icon: React.ReactNode, color: string) => {
    const on = space === s;
    return (
      <Box component="button" type="button" onClick={() => setSpace(s)} aria-pressed={on}
        sx={{
          all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.75, py: 0.75, fontSize: "0.9rem", fontWeight: 700,
          color: on ? "#fff" : color, bgcolor: on ? color : "transparent", transition: "background-color .12s",
          "&:hover": { bgcolor: on ? color : "rgba(21,34,58,.05)" }, "&:focus-visible": { outline: `2px solid ${color}`, outlineOffset: -2 },
        }}>
        {icon}{label}
      </Box>
    );
  };
  return (
    <Box role="group" aria-label="Live or sandbox" sx={{ display: "inline-flex", border: "1px solid rgba(21,34,58,.16)", borderRadius: "12px", overflow: "hidden", bgcolor: "#fff", boxShadow: "0 1px 4px rgba(31,45,78,.08)" }}>
      {btn("live", "Live", <PublicOutlinedIcon sx={{ fontSize: 18 }} />, "#1b7a55")}
      {btn("sandbox", "Sandbox", <ScienceOutlinedIcon sx={{ fontSize: 18 }} />, "#b7791f")}
    </Box>
  );
}

/** The sandbox, under the views: what it is, the parts that differ from live - each one brought to live by an admin, or
 *  put back to live - and starting again from live. Nothing goes to live by itself. */
function SandboxBar({ d, sbRules, admin, busy, onPromote, onReset }: {
  d: MapData; sbRules: AssignRules; admin: boolean; busy: boolean;
  onPromote: (part: string) => void; onReset: (part: string | true) => void;
}) {
  const parts = rulesParts(sbRules, d.rules);
  const [sure, setSure] = useState<string | null>(null);
  const sb = d.sandbox ?? null;
  const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "10px", py: 0.25 };
  return (
    <Box sx={{ border: "1px solid #ecd29b", bgcolor: "#fdf8ee", borderRadius: "14px", px: 2, py: 1.25, display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <ScienceOutlinedIcon sx={{ fontSize: 20, color: "#b7791f" }} />
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#7a5410" }}>Sandbox</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: "#7a5410", flex: 1, minWidth: 240 }}>
          Try the rules here: the map and the KPIs show what they would give, each KPI against live. Nothing here changes HubSpot or the live rules.
        </Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{sb?.at ? `Saved by itself · ${when(sb.at)}${sb.by ? ` by ${sb.by}` : ""}` : "A copy of live - change anything to start"}</Typography>
      </Box>
      {parts.length ? (
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {parts.map((part) => (
            <Box key={part} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Chip tint="amber">{partName(part)}</Chip>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>differs from live</Typography>
              <Box sx={{ flex: 1 }} />
              {sure === part ? (
                <>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{part === "sae" ? "The live SAE table becomes the sandbox's" : `The live rules of ${partName(part)} become the sandbox's`} - every company is decided again{d.live[part] ? `; ${partName(part)} is LIVE: the hub writes the changes to HubSpot` : ""}.</Typography>
                  <Box component="button" type="button" disabled={busy} onClick={() => { setSure(null); onPromote(part); }}
                    sx={{ all: "unset", cursor: busy ? "default" : "pointer", px: 1.5, py: 0.5, borderRadius: "10px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", bgcolor: busy ? "#8fb8a6" : "#1b7a55",
                      "&:hover": { bgcolor: busy ? "#8fb8a6" : "#166548" }, "&:focus-visible": { outline: "2px solid #1b7a55", outlineOffset: 2 } }}>Yes, bring to live</Box>
                  <Button size="small" onClick={() => setSure(null)} sx={btn}>Cancel</Button>
                </>
              ) : (
                <>
                  {admin && <Button size="small" variant="outlined" disabled={busy} onClick={() => setSure(part)} sx={{ ...btn, color: "#1b7a55", borderColor: "rgba(27,122,85,.4)" }}>Bring to live</Button>}
                  <Button size="small" disabled={busy} onClick={() => onReset(part)} sx={{ ...btn, color: MUTED }}>Back to live</Button>
                </>
              )}
            </Box>
          ))}
        </Box>
      ) : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Same as live.</Typography>}
      {!admin && parts.length > 0 && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>An admin brings a part to live.</Typography>}
      {sb && parts.length > 0 && <Button size="small" disabled={busy} onClick={() => onReset(true)} sx={{ ...btn, color: MUTED, justifySelf: "start", px: 0 }}>Start again from live</Button>}
    </Box>
  );
}

/** Saving, on the right of the views: quiet when all is saved, Undo + Save when the map shows edits. */
function SaveStrip({ d, dirty, check, busy, msg, onSave, onUndo, space }: {
  d: MapData; dirty: boolean; check: { errors: string[] }; busy: boolean; msg: { ok: boolean; text: string } | null;
  onSave: () => void; onUndo: () => void; space: Space;
}) {
  if (space === "sandbox") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
        {msg && !msg.ok && <Typography sx={{ fontSize: "0.78rem", color: RED, maxWidth: 420 }}>{msg.text}</Typography>}
        {check.errors.length > 0 && <Typography sx={{ fontSize: "0.78rem", color: RED, maxWidth: 320 }}>{check.errors[0]}</Typography>}
        {(busy || dirty) && <CircularProgress size={14} />}
        <Chip tint="amber">{busy || dirty ? "Sandbox - saving…" : "Sandbox - saved"}</Chip>
      </Box>
    );
  }
  const saved = d.at ? `Saved ${when(d.at)}${d.by ? ` by ${d.by}` : ""}` : "As seeded from the HubSpot workflows";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
      {msg && <Typography sx={{ fontSize: "0.78rem", color: msg.ok ? "#1b7a55" : RED, maxWidth: 420 }}>{msg.text}</Typography>}
      {!d.admin && <Chip tint="slate">read only</Chip>}
      {dirty ? (
        <>
          <Chip tint="amber">Unsaved changes</Chip>
          {check.errors.length > 0 && (
            <Tooltip title={check.errors.slice(0, 8).join(" · ")}>
              <Typography sx={{ fontSize: "0.78rem", color: RED, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {check.errors[0]}{check.errors.length > 1 ? ` (+${check.errors.length - 1})` : ""}
              </Typography>
            </Tooltip>
          )}
          {busy && <CircularProgress size={14} />}
          {d.admin && <Button size="small" disabled={busy} onClick={onUndo} sx={{ textTransform: "none" }}>Undo</Button>}
          {d.admin && (
            <Button size="small" variant="contained" disableElevation startIcon={<SaveOutlinedIcon />} disabled={busy || check.errors.length > 0} onClick={onSave}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Save</Button>
          )}
        </>
      ) : !msg && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{saved}</Typography>}
    </Box>
  );
}

export default function MapAssignment() {
  const [tab, setView] = useHashTab<View | keyof typeof OLD_VIEW_HASH>(TAB_HASH, "map");
  const view: View = tab === "differences" ? "contacts" : tab;
  useEffect(() => { if (tab === "differences") setView("contacts"); }, [tab, setView]);
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<MapData>(url, [url]);
  // the Contacts view's numbers: its tab shows the share of new contacts that follow the rules
  // the Contacts view reads itself again while a pass is going (cn), without the whole page
  const [cn, setCn] = useState(0);
  const contacts = useContactsData(n, cn);
  const follow = followPct(contacts);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const reload = useCallback(() => setN((x) => x + 1), []);

  // Live or the sandbox, remembered per browser
  const [space, setSpaceState] = useState<Space>("live");
  useEffect(() => { try { if (window.localStorage.getItem(SPACE_KEY) === "sandbox") setSpaceState("sandbox"); } catch { /* no storage */ } }, []);
  const setSpace = (v: Space) => { setSpaceState(v); setMsg(null); try { window.localStorage.setItem(SPACE_KEY, v); } catch { /* no storage */ } };
  const sandboxOn = space === "sandbox";
  // the sandbox's saved rules: a copy of live until someone changes them
  const sbRules = d ? d.sandbox?.rules ?? d.rules : null;
  /** the sandbox's version - the KPIs read its figures again when it changes */
  const sbKey = d ? d.sandbox?.at ?? "copy" : "copy";

  // the rules being edited, one draft per space; null = the saved ones. Kept here so the map and its panels share them.
  const [draftLive, setDraftLive] = useState<AssignRules | null>(null);
  const [draftSb, setDraftSb] = useState<AssignRules | null>(null);
  const draft = sandboxOn ? draftSb : draftLive;
  const setDraftState = sandboxOn ? setDraftSb : setDraftLive;
  const savedNow = sandboxOn ? sbRules : d?.rules ?? null;
  const [rev, setRev] = useState(0);
  const clearOnLoad = useRef(false);
  const rules = draft ?? savedNow ?? null;
  const setDraft = useCallback((f: (x: AssignRules) => AssignRules) => setDraftState((cur) => {
    const from = cur ?? savedNow ?? null;
    return from ? f(from) : cur;
  }), [setDraftState, savedNow]);
  const dirty = !!(savedNow && draft && canon(draft) !== canon(savedNow));
  const seededNow = !!(d && rules && canon(rules) === canon(d.seeded));
  useEffect(() => {
    // after a save: the answer holds the saved rules - drop the draft only then, so the map never jumps back
    if (d && clearOnLoad.current && !held.stale) { clearOnLoad.current = false; setDraftLive(null); setRev((x) => x + 1); }
  }, [d, held.stale]);
  useEffect(() => {
    if (!dirty) return;
    const stop = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);

  // the country, remembered per browser
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { try { const v = window.localStorage.getItem(CC_KEY); if (v && /^[A-Z]{2}$/.test(v)) setPicked(v); } catch { /* no storage */ } }, []);
  const list = d && rules ? countryList(d, rules) : [];
  const cc = picked && list.some((c) => c.cc === picked) ? picked : list[0]?.cc ?? "CH";
  const setCc = (v: string) => { setPicked(v); try { window.localStorage.setItem(CC_KEY, v); } catch { /* no storage */ } };

  const names = useMemo(() => namesOf(d?.owners ?? []), [d]);
  const palette = useMemo(() => (d && rules ? buildPalette(d, rules, names) : () => ({ color: "#c9ced6", ring: false, grey: true, left: false, none: true })), [d, rules, names]);
  const check = useMemo(() => (rules ? checkRules(rules) : { errors: [] }), [rules]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (!msg?.ok) return; const t = window.setTimeout(() => setMsg(null), 6000); return () => window.clearTimeout(t); }, [msg]);
  const save = async () => {
    if (!draft || sandboxOn) return;
    setBusy(true); setMsg(null);
    // never PUT {rules}: the whole rules are past the hub's 8 KB request limit - a patch per changed part
    const res = await saveRules(draft, d?.rules ?? draft);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.text });
    if (res.ok) clearOnLoad.current = true;
    reload();
  };
  const undo = () => { setDraftState(null); setRev((x) => x + 1); setMsg(null); };
  const seeded = () => { if (d) { setDraftState(JSON.parse(JSON.stringify(d.seeded)) as AssignRules); setRev((x) => x + 1); setMsg(null); } };

  // the sandbox saves itself: a moment after the last change, the parts that changed (no re-keyed fields - typing goes on)
  const sbSent = useRef<string | null>(null);
  useEffect(() => {
    // sbSent: a save is waiting for its answer - the next one goes after it
    if (!sandboxOn || !draftSb || !sbRules || busy || sbSent.current || canon(draftSb) === canon(sbRules) || checkRules(draftSb).errors.length) return;
    const t = window.setTimeout(() => {
      void (async () => {
        setBusy(true);
        sbSent.current = canon(draftSb);
        const res = await saveRules(draftSb, sbRules, "sandbox");
        setBusy(false);
        if (!res.ok) { sbSent.current = null; setMsg({ ok: false, text: res.text }); }
        reload();
      })();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [sandboxOn, draftSb, sbRules, busy, reload]);
  useEffect(() => {
    // after the sandbox's save: the draft goes once the answer holds it and nothing was changed since
    if (!d || held.stale || !sbSent.current) return;
    if (draftSb && canon(draftSb) === sbSent.current) setDraftSb(null);
    sbSent.current = null;
  }, [d, held.stale, draftSb]);
  const promote = async (part: string) => {
    setBusy(true); setMsg(null);
    const r = await send("PUT", { promote: { part } });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? `${partName(part)} brought to live - every company is decided again with it.` : `Not brought to live: ${r.error ?? "?"}` });
    if (r.ok) setDraftLive(null);
    reload();
  };
  const resetSandbox = async (part: string | true) => {
    setBusy(true); setMsg(null);
    const r = await send("PUT", { sandbox: { reset: part } });
    setBusy(false);
    if (!r.ok) setMsg({ ok: false, text: `Not done: ${r.error ?? "?"}` });
    setDraftSb(null); setRev((x) => x + 1);
    reload();
  };

  let body: React.ReactNode;
  // Domains has its own engine and API - it never waits for the map's data
  if (view === "domains") body = <DomainsView key="domains" />;
  else if (r === null) body = <LoadingPanel key="loading" label="Reading who owns which companies…" />;
  else if (r.state !== "ok") {
    body = r.state === "error" && r.status === 404
      ? <Info key="missing">The map assignment service is not there yet (HTTP 404). This page fills in once it is deployed.</Info>
      : <UpstreamPanel key="error" source="Map assignment" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={reload} />;
  } else if (d && rules) {
    // the sandbox: the map and the SAE table work on its rules - everyone may change them (they decide nothing)
    const dv: MapData = sandboxOn ? { ...d, rules: sbRules ?? d.rules, admin: true } : d;
    if (view === "contacts") body = <ContactsView key="contacts" d={d} names={names} palette={palette} held={contacts} onRetry={reload} onRefresh={() => setCn((x) => x + 1)} />;
    else if (view === "performis") body = <WrongPerformisView key="performis" names={names} n={n} />;
    else if (view === "nocompany") body = <NoCompanyView key="nocompany" d={d} names={names} onLinked={reload} />;
    else if (view === "live") body = <LiveView key="live" d={d} dirty={dirty} onChanged={reload} />;
    else if (view === "sae") body = <SaeTableView key={`sae-${space}`} d={dv} rules={rules} setDraft={setDraft} names={names} palette={palette} rev={rev} n={n} />;
    else body = <MapView key={`map-${space}`} d={dv} rules={rules} setDraft={setDraft} cc={cc} setCc={setCc} names={names} palette={palette} dirty={dirty} rev={rev} n={n}
      busy={busy} check={check} msg={msg} onSave={() => void save()} onUndo={undo} seededNow={seededNow} onSeeded={seeded}
      sandbox={sandboxOn ? sbKey : null} liveRules={d.rules} />;
  }

  const liveCount = d ? Object.values(d.live).filter(Boolean).length : 0;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 }}>
      <PageHeader
        title="Map assignment"
        subtitle="Who owns each company, per country - by the Performis SAE or by postcode zones on the map; its contacts follow"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {d && <SpaceSwitch space={space} setSpace={setSpace} />}
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", minWidth: 0 }}>
        <ReportTabs name="mapassign" tab={view} onSelect={setView} tabs={[
          { id: "map", label: VIEW_LABEL.map, count: dirty ? "edited" : null },
          { id: "sae", label: VIEW_LABEL.sae, count: d ? String(Object.keys((rules ?? d.rules).sae).length) : null },
          { id: "performis", label: VIEW_LABEL.performis, count: null },
          { id: "contacts", label: VIEW_LABEL.contacts, count: follow !== null ? `${follow}%` : null },
          { id: "nocompany", label: VIEW_LABEL.nocompany, count: d && d.noCompany.length ? full(d.noCompany.length) : null },
          { id: "domains", label: VIEW_LABEL.domains, count: null },
          { id: "live", label: VIEW_LABEL.live, count: liveCount ? `${liveCount} live` : null },
        ]} />
        <Box sx={{ flex: 1 }} />
        {d && <SaveStrip d={d} dirty={dirty} check={check} busy={busy} msg={msg} onSave={() => void save()} onUndo={undo} space={space} />}
      </Box>
      {d && sandboxOn && (view === "map" || view === "sae") && sbRules && (
        <SandboxBar d={d} sbRules={sbRules} admin={d.admin} busy={busy} onPromote={(part) => void promote(part)} onReset={(part) => void resetSandbox(part)} />
      )}
      {d && sandboxOn && msg?.ok && <Typography sx={{ fontSize: "0.8rem", color: "#1b7a55" }}>{msg.text}</Typography>}
      <Box role="tabpanel" id={`mapassign-panel-${view}`} aria-label={`${VIEW_LABEL[view]} view${d && view === "map" ? ` - ${countryName(cc)}` : ""}`}
        sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
