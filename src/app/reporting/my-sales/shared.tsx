"use client";
// MY SALES REPORTS - what the three pages share: who is signed in (the HubSpot owner with their email), the person shown
// (an admin or a sales leader may pick anyone), and the switch My | My team | All ESO (SARCLA 01.11.2026: "they should
// have also filter by My Target | My Team Targets | All ESO" - and the same on Figures and Visits).

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";

import { GUTTER } from "@/app/analytics/Shell";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { FAINT, INK, MUTED, glass } from "@/app/uc/report/ui";
import type { Team } from "@/lib/mapAssign/leadsRules";
import type { PersonTargets } from "@/lib/reporting/mySalesRules";

export type Person = { id: string; name: string };
export type MySales = {
  ok?: boolean; error?: string; year: number;
  /** the HubSpot owner with the email signed in, none when there is no such owner */
  me: Person | null;
  /** the person shown: themselves, or whoever an admin or a sales leader picked */
  subject: Person | null;
  canPick: boolean; canEdit: boolean;
  /** what the person shown set - only with the Targets page given */
  targets: PersonTargets | null;
  /** their line manager's team (Map assignment's SAE table) */
  team: string | null; teams: Team[];
  /** ESO's people, to pick from (admins and sales leaders) */
  people: Person[];
};

/** Who is signed in and who is shown; `owner` picks someone else (admins and sales leaders). */
export function useMySales(owner: string | null) {
  const [st, setSt] = useState<MySales | null>(null);
  const load = useCallback(() => {
    let alive = true;
    fetch(`/api/reporting/my-sales${owner ? `?owner=${owner}` : ""}`).then((r) => r.json())
      .then((j: MySales) => { if (alive) setSt(j); })
      .catch((e) => { if (alive) setSt((s) => ({ ...(s ?? EMPTY), ok: false, error: String((e as Error)?.message ?? e) })); });
    return () => { alive = false; };
  }, [owner]);
  useEffect(() => load(), [load]);
  return { st, setTargets: (t: PersonTargets) => setSt((s) => (s ? { ...s, targets: t } : s)) };
}
const EMPTY: MySales = { year: new Date().getFullYear(), me: null, subject: null, canPick: false, canEdit: false, targets: null, team: null, teams: [], people: [] };

/** The person picked, kept across the three pages (admins and sales leaders). */
const KEPT_OWNER = "mySales.owner";
export function usePicked(): [string | null, (id: string | null) => void] {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { try { setV(localStorage.getItem(KEPT_OWNER)); } catch { /* none */ } }, []);
  return [v, (id) => { setV(id); try { if (id) localStorage.setItem(KEPT_OWNER, id); else localStorage.removeItem(KEPT_OWNER); } catch { /* here only */ } }];
}

export type Scope = "me" | "team" | "all";
const KEPT_SCOPE = "mySales.scope";
/** My | My team | All ESO, kept across the pages. */
export function useScope(): [Scope, (s: Scope) => void] {
  const [v, setV] = useState<Scope>("me");
  useEffect(() => { try { const x = localStorage.getItem(KEPT_SCOPE); if (x === "me" || x === "team" || x === "all") setV(x); } catch { /* mine */ } }, []);
  return [v, (s) => { setV(s); try { localStorage.setItem(KEPT_SCOPE, s); } catch { /* here only */ } }];
}

/** The team shown under My team, kept (admins and sales leaders may pick any). */
const KEPT_TEAM = "mySales.team";
export function usePickedTeam(): [string | null, (id: string) => void] {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { try { setV(localStorage.getItem(KEPT_TEAM)); } catch { /* none */ } }, []);
  return [v, (id) => { setV(id); try { localStorage.setItem(KEPT_TEAM, id); } catch { /* here only */ } }];
}

export const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;

/** My … | My team | All ESO; under My team, for those who may pick, every team beside it. */
export function ScopeBar({ scope, onScope, mine, teamLabel, teams, team, onTeam, canPick }: {
  scope: Scope; onScope: (s: Scope) => void; mine: string; teamLabel: string;
  teams: Team[]; team: string | null; onTeam: (id: string) => void; canPick: boolean;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
      <ReportTabs name="my-sales-scope" tab={scope} onSelect={onScope}
        tabs={[{ id: "me", label: mine, count: null }, { id: "team", label: teamLabel, count: null }, { id: "all", label: "All ESO", count: null }]} />
      {scope === "team" && canPick && teams.length > 0 && (
        <ReportTabs name="my-sales-team" tab={team && teams.some((t) => t.id === team) ? team : teams[0].id} onSelect={onTeam}
          tabs={teams.map((t) => ({ id: t.id, label: t.name, count: null }))} />
      )}
    </Box>
  );
}

/** For admins and sales leaders: whose page this is. */
export function PersonPicker({ st, picked, onPick }: { st: MySales; picked: string | null; onPick: (id: string | null) => void }) {
  if (!st.canPick) return null;
  const people = [...st.people].sort((a, b) => a.name.localeCompare(b.name));
  const value = picked && people.some((p) => p.id === picked) ? picked : "";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>Showing</Typography>
      <Select size="small" displayEmpty value={value} onChange={(e) => onPick(e.target.value ? String(e.target.value) : null)}
        sx={{ minWidth: 220, fontSize: "0.84rem", borderRadius: "10px", bgcolor: "#fff", "& .MuiSelect-select": { py: 0.75 } }}>
        <MenuItem value="" sx={{ fontSize: "0.84rem" }}>{st.me ? `Me (${st.me.name})` : "Me"}</MenuItem>
        {people.map((p) => <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.84rem" }}>{p.name}</MenuItem>)}
      </Select>
    </Box>
  );
}

/** A plain note in the page's glass - no owner for the email, no team set, … */
export function Note({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2.25, display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{title}</Typography>
      {children && <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>{children}</Typography>}
    </Box>
  );
}

export const footnoteSx = { fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 } as const;
