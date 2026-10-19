"use client";

// MAP ASSIGNMENT - a HubSpot app (UC & HubSpot Apps > HubSpot apps). SARCLA 19.10.2026: "an interactive map with the
// region per person ... that we can automate and change ... per country". Who owns a company is decided in the hub,
// country by country, by the Performis SAE or by postcode zones on a map (France: Jeremy Borey for Auvergne-Rhône-Alpes
// and Bourgogne-Franche-Comté only); key accounts first; the contacts follow their company. Shadow (compare) or live
// (write) per country. The engine is src/lib/mapAssign; this page reads GET /api/uc/map-assignment.
// Views: Map (default), Rules, Differences, No company, Live. Edits to the rules show on the map before they are saved.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, MUTED } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip, Info } from "@/app/connectors/parts";
import type { AssignRules } from "@/lib/mapAssign/rules";
import type { MapData } from "@/lib/mapAssign/api";
import { CountryPicker, MapPanel, sourceNote, useCountryMap } from "./MapPanel";
import { RulesView, SaveBar } from "./RulesView";
import { DiffView } from "./DiffView";
import { NoCompanyView } from "./NoCompanyView";
import { LiveView } from "./LiveView";
import {
  API, VIEW_HASH, buildPalette, canon, checkRules, countryList, countryName, namesOf, saveRules,
  type Names, type Palette, type View,
} from "./shared";

const CC_KEY = "apsomh:map-assignment:country";

function MapView({ d, rules, cc, setCc, names, palette, dirty }: { d: MapData; rules: AssignRules; cc: string; setCc: (cc: string) => void; names: Names; palette: Palette; dirty: boolean }) {
  const m = useCountryMap(cc, rules, d.rules, dirty);
  const note = sourceNote(cc, rules, names);
  return (
    <>
      <CountryPicker list={countryList(d, rules)} cc={cc} onPick={setCc} />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<MapOutlinedIcon />} tint={note.tint} title={note.title} note={note.text}
          right={d.live[cc] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>} />
        <MapPanel m={m} cc={cc} rules={rules} d={d} names={names} palette={palette} />
      </GlassCard>
    </>
  );
}

export default function MapAssignment() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "map");
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<MapData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const reload = useCallback(() => setN((x) => x + 1), []);

  // the rules being edited; null = the saved ones. Kept here so the map and the rules views share them.
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
  const check = useMemo(() => (rules ? checkRules(rules, names) : { errors: [], warnings: [] }), [rules, names]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
    const bar = <SaveBar key="bar" d={d} dirty={dirty} seededNow={seededNow} check={check} busy={busy} msg={msg} onSave={() => void save()} onUndo={undo} onSeeded={seeded} />;
    if (view === "rules") body = <>{bar}<RulesView key="rules" d={d} rules={rules} setDraft={setDraft} cc={cc} setCc={setCc} names={names} palette={palette} rev={rev} dirty={dirty} /></>;
    else if (view === "differences") body = <DiffView key="differences" d={d} names={names} />;
    else if (view === "nocompany") body = <NoCompanyView key="nocompany" d={d} names={names} onLinked={reload} />;
    else if (view === "live") body = <LiveView key="live" d={d} dirty={dirty} onChanged={reload} />;
    else body = <>{(dirty || msg) && bar}<MapView key="map" d={d} rules={rules} cc={cc} setCc={setCc} names={names} palette={palette} dirty={dirty} /></>;
  }

  const liveCount = d ? Object.values(d.live).filter(Boolean).length : 0;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Map assignment"
        subtitle="Who owns each company, per country - by the Performis SAE or by postcode zones on the map; its contacts follow"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {d && !d.admin && <Chip tint="slate">read only</Chip>}
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again"><IconButton size="small" onClick={reload} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      <Box sx={{ minWidth: 0 }}>
        <ReportTabs name="mapassign" tab={view} onSelect={setView} tabs={[
          { id: "map", label: "Map", count: null },
          { id: "rules", label: "Rules", count: dirty ? "edited" : null },
          { id: "differences", label: "Differences", count: d ? full(d.changes.length) : null },
          { id: "nocompany", label: "No company", count: d && d.noCompany.length ? full(d.noCompany.length) : null },
          { id: "live", label: "Live", count: liveCount ? `${liveCount} live` : null },
        ]} />
      </Box>
      <Box role="tabpanel" id={`mapassign-panel-${view}`} aria-label={`${view === "nocompany" ? "No company" : view} view${d ? ` - ${countryName(cc)}` : ""}`}
        sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>{body}</Box>
    </Box>
  );
}
