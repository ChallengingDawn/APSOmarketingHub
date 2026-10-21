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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { MUTED, RED } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Info, when } from "@/app/connectors/parts";
import type { AssignRules } from "@/lib/mapAssign/rules";
import type { MapData } from "@/lib/mapAssign/api";
import { CountryPicker, MapPanel, useCountryMap } from "./MapPanel";
import { RulesDialog, type Place } from "./RulesDialog";
import { ContactsView, followPct, useContactsData } from "./ContactsView";
import { NoCompanyView } from "./NoCompanyView";
import { LiveView } from "./LiveView";
import { SaeTableView } from "./SaeTableView";
import {
  API, OLD_VIEW_HASH, VIEW_HASH, assignInto, buildPalette, canon, checkRules, countryList, countryName, namesOf, saveRules,
  type Names, type Palette, type SetDraft, type View,
} from "./shared";

const CC_KEY = "apsomh:map-assignment:country";
/** The views' hashes, and the old ones that still open a view. */
const TAB_HASH = { ...VIEW_HASH, ...OLD_VIEW_HASH };

const VIEW_LABEL: Record<View, string> = {
  map: "Map", sae: "SAE table", contacts: "Contacts", nocompany: "No company", live: "Live",
};

function MapView({ d, rules, setDraft, cc, setCc, names, palette, dirty, rev, n, busy, check, msg, onSave, onUndo, seededNow, onSeeded }: {
  d: MapData; rules: AssignRules; setDraft: SetDraft; cc: string; setCc: (cc: string) => void; names: Names; palette: Palette; dirty: boolean;
  rev: number; n: number; busy: boolean; check: { errors: string[] }; msg: { ok: boolean; text: string } | null; onSave: () => void; onUndo: () => void;
  seededNow: boolean; onSeeded: () => void;
}) {
  const m = useCountryMap(cc, rules, d.rules, dirty);
  const onAssign = useMemo(() => assignInto(setDraft), [setDraft]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  useEffect(() => { setPlace(null); }, [cc]);
  return (
    <>
      <MapPanel m={m} cc={cc} rules={rules} d={d} names={names} palette={palette} onAssign={onAssign} setDraft={setDraft}
        top={<CountryPicker list={countryList(d, rules)} cc={cc} onPick={setCc} />} onRules={() => { setPlace(null); setRulesOpen(true); }}
        onPlace={(p) => { setPlace(p); setRulesOpen(true); }} />
      <RulesDialog open={rulesOpen} onClose={() => { setRulesOpen(false); setPlace(null); }} place={place} onWholeCountry={() => setPlace(null)} cc={cc} setCc={setCc} d={d} rules={rules} setDraft={setDraft} names={names} palette={palette}
        rev={rev} m={m} n={n} dirty={dirty} busy={busy} check={check} msg={msg} onSave={onSave} onUndo={onUndo}
        seededNow={seededNow} onSeeded={onSeeded} />
    </>
  );
}

/** Saving, on the right of the views: quiet when all is saved, Undo + Save when the map shows edits. */
function SaveStrip({ d, dirty, check, busy, msg, onSave, onUndo }: {
  d: MapData; dirty: boolean; check: { errors: string[] }; busy: boolean; msg: { ok: boolean; text: string } | null;
  onSave: () => void; onUndo: () => void;
}) {
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
  const contacts = useContactsData(n);
  const follow = followPct(contacts);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const reload = useCallback(() => setN((x) => x + 1), []);

  // the rules being edited; null = the saved ones. Kept here so the map and its panels share them.
  const [draft, setDraftState] = useState<AssignRules | null>(null);
  const [rev, setRev] = useState(0);
  const clearOnLoad = useRef(false);
  const rules = draft ?? d?.rules ?? null;
  const setDraft = useCallback((f: (x: AssignRules) => AssignRules) => setDraftState((cur) => {
    const from = cur ?? d?.rules ?? null;
    return from ? f(from) : cur;
  }), [d]);
  const dirty = !!(d && draft && canon(draft) !== canon(d.rules));
  const seededNow = !!(d && rules && canon(rules) === canon(d.seeded));
  useEffect(() => {
    // after a save: the answer holds the saved rules - drop the draft only then, so the map never jumps back
    if (d && clearOnLoad.current && !held.stale) { clearOnLoad.current = false; setDraftState(null); setRev((x) => x + 1); }
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
    if (!draft) return;
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

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel key="loading" label="Reading who owns which companies…" />;
  else if (r.state !== "ok") {
    body = r.state === "error" && r.status === 404
      ? <Info key="missing">The map assignment service is not there yet (HTTP 404). This page fills in once it is deployed.</Info>
      : <UpstreamPanel key="error" source="Map assignment" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={reload} />;
  } else if (d && rules) {
    if (view === "contacts") body = <ContactsView key="contacts" d={d} names={names} palette={palette} held={contacts} onRetry={reload} />;
    else if (view === "nocompany") body = <NoCompanyView key="nocompany" d={d} names={names} onLinked={reload} />;
    else if (view === "live") body = <LiveView key="live" d={d} dirty={dirty} onChanged={reload} />;
    else if (view === "sae") body = <SaeTableView key="sae" d={d} rules={rules} setDraft={setDraft} names={names} palette={palette} rev={rev} n={n} />;
    else body = <MapView key="map" d={d} rules={rules} setDraft={setDraft} cc={cc} setCc={setCc} names={names} palette={palette} dirty={dirty} rev={rev} n={n}
      busy={busy} check={check} msg={msg} onSave={() => void save()} onUndo={undo} seededNow={seededNow} onSeeded={seeded} />;
  }

  const liveCount = d ? Object.values(d.live).filter(Boolean).length : 0;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 }}>
      <PageHeader
        title="Map assignment"
        subtitle="Who owns each company, per country - by the Performis SAE or by postcode zones on the map; its contacts follow"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", minWidth: 0 }}>
        <ReportTabs name="mapassign" tab={view} onSelect={setView} tabs={[
          { id: "map", label: VIEW_LABEL.map, count: dirty ? "edited" : null },
          { id: "sae", label: VIEW_LABEL.sae, count: d ? String(Object.keys((rules ?? d.rules).sae).length) : null },
          { id: "contacts", label: VIEW_LABEL.contacts, count: follow !== null ? `${follow}%` : null },
          { id: "nocompany", label: VIEW_LABEL.nocompany, count: d && d.noCompany.length ? full(d.noCompany.length) : null },
          { id: "live", label: VIEW_LABEL.live, count: liveCount ? `${liveCount} live` : null },
        ]} />
        <Box sx={{ flex: 1 }} />
        {d && <SaveStrip d={d} dirty={dirty} check={check} busy={busy} msg={msg} onSave={() => void save()} onUndo={undo} />}
      </Box>
      <Box role="tabpanel" id={`mapassign-panel-${view}`} aria-label={`${VIEW_LABEL[view]} view${d && view === "map" ? ` - ${countryName(cc)}` : ""}`}
        sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
