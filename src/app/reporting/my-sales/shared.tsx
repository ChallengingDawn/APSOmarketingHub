"use client";
// MY SALES REPORTS - what its pages share: who is signed in (the HubSpot owner with their email), where they stand in the
// hierarchy (Settings > Hierarchy), and the switch Mine | My team | All ESO (or All TSA) | All (SARCLA 01.11.2026: "Adem
// should only see his KPIs + all ESO + all with TSA, a TSA person vice versa"; a manager also everyone under them; "he
// should not be able to see other teams"). Only an admin picks someone else. The ESO pages are drawn whole inside it,
// for the people of the switch (../scope.tsx).

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";

import { GUTTER } from "@/app/analytics/Shell";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { FAINT, INK, MUTED, glass } from "@/app/uc/report/ui";
import { useViewAs } from "@/app/ViewAs";
import { ScopeProvider, type Scope } from "@/app/reporting/scope";
import { scopeOf, viewsOf, type View } from "@/lib/reporting/mySalesScope";

export { viewsOf, type View };
import type { PersonTargets } from "@/lib/reporting/mySalesRules";

export type Person = { id: string; name: string };
export type MySales = {
  ok?: boolean; error?: string; year: number;
  /** the HubSpot owner with the email signed in (or previewed), none when there is no such owner */
  me: Person | null;
  /** the person shown: themselves, or whoever an admin picked */
  subject: Person | null;
  canPick: boolean; canEdit: boolean;
  /** their unit in the hierarchy, and the reports it is drawn in */
  unit: string | null; reports: "eso" | "tsa" | null;
  /** them and everyone under them - empty when nobody reports to them */
  team: Person[];
  /** what the person shown set - only with the Targets page given */
  targets: PersonTargets | null;
  /** the people an admin picks from */
  people: (Person & { unit: string | null })[];
};

/** Who is signed in and who is shown; `owner` picks someone else (admins). A preview (View as) is answered as that person. */
export function useMySales(owner: string | null) {
  const { viewed } = useViewAs();
  const [st, setSt] = useState<MySales | null>(null);
  const as = viewed ? String(viewed.id) : null;
  const load = useCallback(() => {
    let alive = true;
    const q = new URLSearchParams();
    if (owner) q.set("owner", owner);
    if (as) q.set("as", as);
    fetch(`/api/reporting/my-sales${q.toString() ? `?${q}` : ""}`).then((r) => r.json())
      .then((j: MySales) => { if (alive) setSt(j); })
      .catch((e) => { if (alive) setSt((s) => ({ ...(s ?? EMPTY), ok: false, error: String((e as Error)?.message ?? e) })); });
    return () => { alive = false; };
  }, [owner, as]);
  useEffect(() => load(), [load]);
  return { st, setTargets: (t: PersonTargets) => setSt((s) => (s ? { ...s, targets: t } : s)) };
}
const EMPTY: MySales = { year: new Date().getFullYear(), me: null, subject: null, canPick: false, canEdit: false, unit: null, reports: null, team: [], targets: null, people: [] };

/** The person an admin picked, kept across the pages. */
const KEPT_OWNER = "mySales.owner";
function usePicked(): [string | null, (id: string | null) => void] {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { try { setV(localStorage.getItem(KEPT_OWNER)); } catch { /* none */ } }, []);
  return [v, (id) => { setV(id); try { if (id) localStorage.setItem(KEPT_OWNER, id); else localStorage.removeItem(KEPT_OWNER); } catch { /* here only */ } }];
}

const KEPT_VIEW = "mySales.view";

/**
 * Everything a My Sales page needs: the person, the view of the switch, the bar that sets it, the scope it makes. Only
 * Targets lets an admin pick someone (`pick`); every other page is the person signed in, or the one View as previews
 * (SARCLA 02.11.2026: "Showing should only be available in Targets - the rest the system should get per user").
 */
export function useMySalesFrame({ pick = false }: { pick?: boolean } = {}) {
  const [kept, setPicked] = usePicked();
  const picked = pick ? kept : null;
  const { st, setTargets } = useMySales(picked);
  const [keptView, setKept] = useState<View>("me");
  useEffect(() => { try { const x = localStorage.getItem(KEPT_VIEW); if (x === "me" || x === "team" || x === "unit" || x === "all") setKept(x); } catch { /* mine */ } }, []);
  const views = viewsOf(st);
  // a view this person does not have (no one under them, no unit) falls back to their own
  const view: View = views.some((v) => v.id === keptView) ? keptView : "me";
  const setView = (v: View) => { setKept(v); try { localStorage.setItem(KEPT_VIEW, v); } catch { /* here only */ } };
  const bar = (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", justifySelf: "start", minWidth: 0 }}>
      <ReportTabs name="my-sales-view" tab={view} onSelect={setView} tabs={views.map((v) => ({ ...v, count: null }))} />
      {st && pick && <PersonPicker st={st} picked={picked} onPick={setPicked} />}
    </Box>
  );
  const scope = useMemo<Scope | null>(() => (st?.ok ? { ...scopeOf(st, view), bar } : null), [st, view]); // eslint-disable-line react-hooks/exhaustive-deps
  return { st, view, setView, bar, scope, setTargets };
}

/** An ESO page drawn whole inside My Sales Reports, for the people of the switch. */
export function MySalesFrame({ children }: { children: React.ReactNode }) {
  const { st, scope, bar } = useMySalesFrame();
  if (!st) return <Box sx={shell}><Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Reading who you are…</Typography></Box>;
  if (!scope) return <Box sx={shell}>{bar}<Note title="My Sales Reports could not be read">{st.error ?? "Try again in a moment."}</Note></Box>;
  return (
    <>
      {!st.subject && (
        <Box sx={{ px: GUTTER, pt: 1.5 }}>
          <Note title="No figures of your own here">Your email is not a HubSpot owner&apos;s, so the reports cannot tell which customers are yours. All still shows - an admin can check the email on your HubSpot user.</Note>
        </Box>
      )}
      <ScopeProvider value={scope}>{children}</ScopeProvider>
    </>
  );
}

/** For admins: whose page this is. */
export function PersonPicker({ st, picked, onPick }: { st: MySales; picked: string | null; onPick: (id: string | null) => void }) {
  if (!st.canPick) return null;
  const people = [...st.people].sort((a, b) => a.name.localeCompare(b.name));
  const value = picked && people.some((p) => p.id === picked) ? picked : "";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>Showing</Typography>
      <Select size="small" displayEmpty value={value} onChange={(e) => onPick(e.target.value ? String(e.target.value) : null)}
        sx={{ minWidth: 220, fontSize: "0.84rem", borderRadius: "10px", bgcolor: "#fff", "& .MuiSelect-select": { py: 0.75 } }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}>
        <MenuItem value="" sx={{ fontSize: "0.84rem" }}>{st.me ? `Me (${st.me.name})` : "Me"}</MenuItem>
        {people.map((p) => <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.84rem" }}>{p.name}{p.unit ? <span style={{ color: FAINT }}>&nbsp;· {p.unit}</span> : null}</MenuItem>)}
      </Select>
    </Box>
  );
}

export const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;

/** A plain note in the page's glass - no owner for the email, … */
export function Note({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2.25, display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>{title}</Typography>
      {children && <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>{children}</Typography>}
    </Box>
  );
}

export const footnoteSx = { fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 } as const;
