"use client";

// MAP ASSIGNMENT - the differences, by person (SARCLA 20.10.2026: "Difference screen completely repaint as well" -
// lead with the moves by person: who gains, who loses, one line per move, click a line for its companies, filter by
// country). From d.moves, complete over the whole table (d.changes stops at 3,000); a move's companies come from the
// server 50 at a time (GET ?changes=1&country=&from=&to=&q=&offset=, from "" = nobody).

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloseIcon from "@mui/icons-material/Close";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { ChangesPage, CompanyChange, MapData, MoveStat } from "@/lib/mapAssign/api";
import type { OwnerId } from "@/lib/mapAssign/rules";
import { API, FLAG_LABEL, Swatch, VIA_LABEL, countryName, hsCompany, type Names, type Palette } from "./shared";

/** Country pills shown before the rest go behind "more". */
const TOP = 8;
const PAGE = 50;
/** a move's companies from md up: company, where, why, contacts off, written */
const COLS = "minmax(0, 1.3fr) minmax(0, 0.8fr) minmax(0, 1.5fr) 100px 130px";

type Move = { key: string; from: OwnerId | null; to: OwnerId; companies: number; contacts: number; countries: { cc: string; companies: number }[] };
type Person = { key: string; id: OwnerId | null; gets: number; gives: number; net: number };

/** "" = nobody (no owner now) - as the route's from="" */
const pkey = (id: OwnerId | null | undefined) => (id ? String(id) : "");
/** the owner is right already: only region responsibility or contacts to fix */
const same = (m: { from: OwnerId | null; to: OwnerId }) => pkey(m.from) === pkey(m.to);
const many = (n: number, one: string, more: string) => `${full(n)} ${n === 1 ? one : more}`;
const signed = (n: number) => (n > 0 ? `+${full(n)}` : n < 0 ? `−${full(-n)}` : "±0");

function Written({ c, live }: { c: CompanyChange; live: boolean }) {
  if (c.wrote) return c.wrote.ok
    ? <Chip tint="green">written {when(c.wrote.at)}</Chip>
    : <Typography component="span" sx={{ fontSize: "0.76rem", color: RED }} title={c.wrote.error ?? ""}>failed{c.wrote.error ? `: ${c.wrote.error}` : ""}</Typography>;
  return live ? <Chip tint="amber">next scan</Chip> : <Chip tint="slate">shadow</Chip>;
}

function Who({ id, names, palette, strong = false }: { id: OwnerId | null; names: Names; palette: Palette; strong?: boolean }) {
  const left = !!id && !names.active(id);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, minWidth: 0, maxWidth: "100%" }}>
      <Swatch paint={palette(id)} />
      <Box component="span" sx={{ fontSize: "0.86rem", fontWeight: strong ? 700 : 600, color: id ? INK : MUTED, ...clip(240) }} title={id ? names.name(id) : "No owner"}>
        {id ? names.name(id) : "No owner"}
      </Box>
      {left && <Box component="span" sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>has left</Box>}
    </Box>
  );
}

/** One move's companies, from the server, a page at a time. */
function MoveCompanies({ from, to, country, d, names }: { from: OwnerId | null; to: OwnerId; country: string | null; d: MapData; names: Names }) {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [got, setGot] = useState<{ key: string; page?: ChangesPage; error?: string } | null>(null);
  useEffect(() => {
    const next = typed.trim();
    if (next === q) return;
    const t = setTimeout(() => { setQ(next); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [typed, q]);
  const key = `${pkey(from)}|${pkey(to)}|${country ?? ""}|${q}|${offset}`;
  useEffect(() => {
    const ac = new AbortController();
    const p = new URLSearchParams({ changes: "1", from: pkey(from), to: pkey(to), offset: String(offset) });
    if (country) p.set("country", country);
    if (q) p.set("q", q);
    fetch(`${API}?${p.toString()}`, { signal: ac.signal })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; data?: ChangesPage } | null;
        if (!j) throw new Error(r.status === 403 ? "refused (HTTP 403) - signed out?" : `HTTP ${r.status}`);
        if (j.ok !== true || !j.data) throw new Error(j.error ?? `HTTP ${r.status}`);
        setGot({ key, page: j.data });
      })
      .catch((e: unknown) => { if (!ac.signal.aborted) setGot({ key, error: (e as Error).message || "failed" }); });
    return () => ac.abort();
  }, [key, from, to, country, q, offset]);
  const loading = !got || got.key !== key;
  const page = got?.page;
  const showCountry = !country;
  return (
    <Box sx={{ mt: 0.75, mb: 1.25, ml: { xs: 0, md: 3 }, p: { xs: 1.25, md: 1.5 }, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.55)", minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
        <TextField size="small" placeholder="Search company, postcode or SAE" value={typed} onChange={(e) => setTyped(e.target.value)}
          sx={{ width: { xs: "100%", sm: 280 }, "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.6 } }} slotProps={{ htmlInput: { "aria-label": "Search the companies of this move" } }} />
        {loading && <CircularProgress size={14} />}
        {page && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{many(page.total, "company", "companies")}{q ? ` for “${q}”` : ""}</Typography>}
      </Box>
      {got?.error && got.key === key && <Typography sx={{ fontSize: "0.8rem", color: RED, mb: 1 }}>Could not read the companies: {got.error}</Typography>}
      {page && page.rows.length > 0 && (
        // columns from md up, one company per stacked block on a phone
        <Box sx={{ opacity: loading ? 0.55 : 1, minWidth: 0 }}>
          <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: COLS, gap: 1.5, px: 0.5, pb: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
            {["Company", "Where", "Why", "Contacts off", "Written"].map((h) => <Box key={h} sx={{ ...headCell, textAlign: h === "Contacts off" ? "right" : "left" }}>{h}</Box>)}
          </Box>
          {page.rows.map((c) => {
            const regionOff = String(c.regionNow ?? "") !== String(c.decided.owner ?? "");
            return (
              <Box key={c.id} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: COLS }, gap: { xs: 0.4, md: 1.5 }, px: 0.5, py: 1, borderBottom: `1px solid ${HAIRLINE}`, alignItems: "start", minWidth: 0 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box component="a" href={hsCompany(c.id)} target="_blank" rel="noopener" title={c.name}
                    sx={{ color: INK, fontWeight: 600, fontSize: "0.84rem", textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || c.id}</Box>
                  {c.decided.flags.length > 0 && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
                      {c.decided.flags.map((f) => <Chip key={f} tint={f === "owner-deactivated" ? "pink" : "amber"}>{FLAG_LABEL[f] ?? f}</Chip>)}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, flexWrap: "wrap", columnGap: 0.75, fontSize: "0.8rem", color: INK, minWidth: 0 }}>
                  <Box component="span" sx={{ whiteSpace: "nowrap" }}>{showCountry ? `${c.country ?? "—"} · ` : ""}{c.zip || "no postcode"}</Box>
                  <Box component="span" sx={{ fontSize: "0.74rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.sae ?? ""}>{c.sae ? `SAE ${c.sae}` : "no SAE"}</Box>
                </Box>
                <Box sx={{ fontSize: "0.8rem", minWidth: 0 }}>
                  <Chip tint="slate">{VIA_LABEL[c.decided.via] ?? c.decided.via}</Chip>
                  {c.decided.detail && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }} title={c.decided.detail}>{c.decided.detail}</Typography>}
                  {regionOff && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>region responsibility now: {names.name(c.regionNow)}</Typography>}
                </Box>
                <Box sx={{ display: { xs: "flex", md: "contents" }, alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Box sx={{ display: { xs: c.contactsOff ? "block" : "none", md: "block" }, fontSize: "0.82rem", color: INK, textAlign: { md: "right" } }}>
                    {c.contactsOff ? <>{full(c.contactsOff)}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> {c.contactsOff === 1 ? "contact" : "contacts"} off</Box></> : ""}
                  </Box>
                  <Box sx={{ whiteSpace: "nowrap" }}><Written c={c} live={!!d.live[c.country ?? ""]} /></Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      {page && !page.rows.length && !loading && (
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{q ? "No company with this search." : "No company left here - the next scan updates the counts."}</Typography>
      )}
      {page && page.total > PAGE && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end", flexWrap: "wrap", mt: 1, pt: 1, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mr: "auto" }}>{full(page.offset + 1)}-{full(Math.min(page.offset + PAGE, page.total))} of {full(page.total)}</Typography>
          <Button size="small" disabled={loading || page.offset === 0} onClick={() => setOffset(Math.max(0, page.offset - PAGE))} sx={{ textTransform: "none" }}>Previous</Button>
          <Button size="small" disabled={loading || page.offset + PAGE >= page.total} onClick={() => setOffset(page.offset + PAGE)} sx={{ textTransform: "none" }}>Next</Button>
        </Box>
      )}
    </Box>
  );
}

function PersonRow({ p, on, onPick, names, palette }: { p: Person; on: boolean; onPick: () => void; names: Names; palette: Palette }) {
  return (
    <Box component="button" type="button" onClick={onPick} aria-pressed={on} sx={{
      all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0,
      px: 1, py: 0.6, borderRadius: "10px", border: `1px solid ${on ? ACCENT : "transparent"}`, bgcolor: on ? "rgba(36,89,209,.06)" : "transparent",
      "&:hover": { bgcolor: on ? "rgba(36,89,209,.09)" : "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
    }}>
      <Box component="span" sx={{ flex: 1, minWidth: 0, display: "block" }}>
        <Who id={p.id} names={names} palette={palette} />
        <Box component="span" sx={{ display: "block", fontSize: "0.74rem", color: MUTED, pl: "18px" }}>gets {full(p.gets)} · gives {full(p.gives)}</Box>
      </Box>
      <Box component="span" sx={{ fontSize: "0.95rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: p.net > 0 ? GREEN : p.net < 0 ? RED : MUTED, whiteSpace: "nowrap" }}>{signed(p.net)}</Box>
    </Box>
  );
}

function PeopleList({ title, list, person, onPick, names, palette, empty }: {
  title: string; list: Person[]; person: string | null; onPick: (k: string) => void; names: Names; palette: Palette; empty: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, TOP);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5, px: 1 }}>{title} · {list.length}</Typography>
      {shown.map((p) => <PersonRow key={p.key || "nobody"} p={p} on={person === p.key} onPick={() => onPick(p.key)} names={names} palette={palette} />)}
      {!list.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED, px: 1 }}>{empty}</Typography>}
      {list.length > TOP && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", mt: 0.5 }}>{all ? "Show fewer" : `Show all ${list.length}`}</Button>
      )}
    </Box>
  );
}

export function DiffView({ d, names, palette }: { d: MapData; names: Names; palette: Palette }) {
  const all = d.moves ?? [];
  const [country, setCountry] = useState<string>("all");
  const [person, setPerson] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // countries with something to change, biggest first
  const byCountry = useMemo(() => {
    const m = new Map<string, { companies: number; contacts: number }>();
    for (const x of all) {
      const c = m.get(x.country) ?? { companies: 0, contacts: 0 };
      // the pills count companies that change owner, as the line under them does
      if (x.from !== x.to) c.companies += x.companies;
      c.contacts += x.contacts;
      m.set(x.country, c);
    }
    return [...m].filter(([, v]) => v.companies || v.contacts)
      .sort((a, b) => b[1].companies - a[1].companies || b[1].contacts - a[1].contacts || a[0].localeCompare(b[0]));
  }, [all]);
  const cc = country !== "all" && byCountry.some(([c]) => c === country) ? country : "all";
  const top = byCountry.slice(0, TOP), rest = byCountry.slice(TOP);
  const inCountry = useMemo(() => all.filter((m) => cc === "all" || m.country === cc), [all, cc]);

  const sum = (list: MoveStat[], f: (m: MoveStat) => number) => list.reduce((a, m) => a + f(m), 0);
  const moving = inCountry.filter((m) => !same(m));
  const fixing = inCountry.filter(same);
  const owners = { companies: sum(moving, (m) => m.companies), contacts: sum(moving, (m) => m.contacts) };
  const fixes = { companies: sum(fixing, (m) => m.companies), contacts: sum(fixing, (m) => m.contacts) };

  // who gains, who loses: companies moving to / away from each person (the right owner already does not count)
  const people = useMemo(() => {
    const m = new Map<string, Person>();
    const at = (id: OwnerId | null) => {
      const k = pkey(id);
      let p = m.get(k);
      if (!p) { p = { key: k, id: id ? String(id) : null, gets: 0, gives: 0, net: 0 }; m.set(k, p); }
      return p;
    };
    for (const x of inCountry) {
      if (same(x)) continue;
      at(x.to).gets += x.companies;
      at(x.from).gives += x.companies;
    }
    const out = [...m.values()].filter((p) => p.gets || p.gives);
    for (const p of out) p.net = p.gets - p.gives;
    return out;
  }, [inCountry]);
  const label = (p: Person) => (p.id ? names.name(p.id) : "No owner");
  const gain = people.filter((p) => p.net >= 0).sort((a, b) => b.net - a.net || b.gets - a.gets || label(a).localeCompare(label(b)));
  const lose = people.filter((p) => p.net < 0).sort((a, b) => a.net - b.net || b.gives - a.gives || label(a).localeCompare(label(b)));

  // one line per move: owner now -> owner by the rules (all countries: the same move merged across them)
  const moves = useMemo(() => {
    const m = new Map<string, Move>();
    for (const x of inCountry) {
      if (person !== null && pkey(x.from) !== person && pkey(x.to) !== person) continue;
      const key = `${pkey(x.from)}>${pkey(x.to)}`;
      let v = m.get(key);
      if (!v) { v = { key, from: x.from, to: x.to, companies: 0, contacts: 0, countries: [] }; m.set(key, v); }
      v.companies += x.companies; v.contacts += x.contacts;
      v.countries.push({ cc: x.country, companies: x.companies });
    }
    for (const v of m.values()) v.countries.sort((a, b) => b.companies - a.companies || a.cc.localeCompare(b.cc));
    return [...m.values()].sort((a, b) => b.companies - a.companies || b.contacts - a.contacts || a.key.localeCompare(b.key));
  }, [inCountry, person]);
  const { slice, pager, setPage } = usePaged(moves, 15);

  const pickCountry = (v: string) => { setCountry(v); setOpen(null); setPage(0); };
  const pickPerson = (k: string) => { setPerson((cur) => (cur === k ? null : k)); setOpen(null); setPage(0); };

  if (!all.length || !byCountry.length) {
    return d.last
      ? <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}><CardTitle icon={<CompareArrowsOutlinedIcon />} tint="green" title="Nothing to change" note={`Every company has the owner the rules give it - last scan ${when(d.last.at)}`} /></GlassCard>
      : <Info>No scan yet - the differences appear after the first one.</Info>;
  }

  const where = cc === "all" ? "all countries" : countryName(cc);
  const liveCount = Object.values(d.live).filter(Boolean).length;
  const personName = person === null ? "" : person ? names.name(person) : "No owner";
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title="What the saved rules would change"
          note={d.last ? `Last scan ${when(d.last.at)}. Shadow countries only compare; live countries are written at every scan` : "Not scanned yet"}
          right={cc === "all" ? (liveCount ? <Chip tint="pink">{liveCount} live</Chip> : <Chip tint="slate">all shadow</Chip>) : d.live[cc] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>} />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <Choice<string> value={cc} onChange={pickCountry} options={[
            { key: "all", label: `All · ${full(sum(all, (m) => (m.from !== m.to ? m.companies : 0)))}` },
            ...top.map(([c, v]) => ({ key: c, label: `${countryName(c)} · ${full(v.companies)}` })),
          ]} />
          {rest.length > 0 && (
            <Select size="small" displayEmpty value={rest.some(([c]) => c === cc) ? cc : ""} onChange={(e) => pickCountry(e.target.value || "all")}
              inputProps={{ "aria-label": "More countries" }}
              sx={{ fontSize: "0.8rem", borderRadius: "999px", "& .MuiSelect-select": { py: 0.45, pl: 1.5 }, ...(rest.some(([c]) => c === cc) ? { color: ACCENT } : { color: MUTED }) }}>
              <MenuItem value="">{`${rest.length} more`}</MenuItem>
              {rest.map(([c, v]) => <MenuItem key={c} value={c}>{`${countryName(c)} · ${full(v.companies)}`}</MenuItem>)}
            </Select>
          )}
        </Box>
        <Box sx={{ mt: 2, display: "grid", gap: 0.25 }}>
          <Typography sx={{ fontSize: "1rem", color: INK }}>
            <b>{many(owners.companies, "company", "companies")}</b> would change owner · <b>{many(owners.contacts, "contact", "contacts")}</b> follow{owners.contacts === 1 ? "s" : ""}
            <Typography component="span" sx={{ fontSize: "0.84rem", color: MUTED }}> - {where}</Typography>
          </Typography>
          {(fixes.companies > 0 || fixes.contacts > 0) && (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
              {fixes.companies > 0
                ? `${many(fixes.companies, "company keeps its", "companies keep their")} owner and only need${fixes.companies === 1 ? "s" : ""} region responsibility or contacts fixed`
                : `${many(fixes.contacts, "contact", "contacts")} to fix on companies that have the right owner`}
            </Typography>
          )}
        </Box>
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="blue" title="Who gains, who loses"
          note={`Companies per person, ${where === "all countries" ? "in all countries" : `in ${where}`} - click a person to see only their moves`} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 3 } }}>
          <PeopleList title="Gain" list={gain} person={person} onPick={pickPerson} names={names} palette={palette} empty="Nobody gains companies here." />
          <PeopleList title="Lose" list={lose} person={person} onPick={pickPerson} names={names} palette={palette} empty="Nobody loses companies here." />
        </Box>
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<SwapHorizOutlinedIcon />} tint="amber" title={`Moves · ${full(moves.length)}`}
          note="Owner now → owner by the saved rules. Click a line for its companies"
          right={person !== null ? (
            <Box component="button" type="button" onClick={() => pickPerson(person)} sx={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.4, borderRadius: "999px",
              border: `1px solid ${ACCENT}`, color: ACCENT, bgcolor: "rgba(36,89,209,.08)", fontSize: "0.8rem", fontWeight: 600, maxWidth: "100%",
              "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
            }} aria-label={`Show everyone, not only ${personName}`}>
              <Box component="span" sx={clip(200)}>Only {personName}</Box><CloseIcon sx={{ fontSize: 15 }} />
            </Box>
          ) : undefined} />
        <Box sx={{ display: "grid" }}>
          {slice.map((m) => {
            const isOpen = open === m.key;
            const fetchCountry = cc !== "all" ? cc : m.countries.length === 1 ? m.countries[0].cc : null;
            return (
              <Box key={m.key} sx={{ borderTop: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
                <Box component="button" type="button" onClick={() => setOpen(isOpen ? null : m.key)} aria-expanded={isOpen} sx={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25, width: "100%", minWidth: 0,
                  px: 1, py: 1, borderRadius: "10px", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
                }}>
                  <Box component="span" sx={{ flex: 1, minWidth: 0, display: "block" }}>
                    {same(m) ? (
                      <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
                        <Who id={m.to} names={names} palette={palette} strong />
                        <Box component="span" sx={{ fontSize: "0.78rem", color: MUTED }}>Owner right - region responsibility or contacts to fix</Box>
                      </Box>
                    ) : (
                      <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
                        <Who id={m.from} names={names} palette={palette} />
                        <ArrowForwardIcon sx={{ fontSize: 15, color: FAINT }} titleAccess="to" />
                        <Who id={m.to} names={names} palette={palette} strong />
                      </Box>
                    )}
                    {cc === "all" && (
                      <Box component="span" sx={{ display: "block", fontSize: "0.74rem", color: MUTED, mt: 0.25, ...clip(520) }}>
                        {m.countries.map((x) => `${x.cc === "??" ? "no country" : x.cc} ${full(x.companies)}`).join(" · ")}
                      </Box>
                    )}
                    {/* on a phone the counts go under the names */}
                    <Box component="span" sx={{ display: { xs: "block", sm: "none" }, fontSize: "0.8rem", color: MUTED, mt: 0.25 }}>
                      {m.companies > 0 && <b style={{ color: INK }}>{many(m.companies, "company", "companies")}</b>}
                      {m.companies > 0 && m.contacts > 0 ? " · " : ""}{m.contacts > 0 ? many(m.contacts, "contact", "contacts") : ""}
                    </Box>
                  </Box>
                  <Box component="span" sx={{ display: { xs: "none", sm: "block" }, textAlign: "right", flexShrink: 0 }}>
                    <Box component="span" sx={{ display: "block", fontSize: "0.92rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {m.companies ? many(m.companies, "company", "companies") : "—"}
                    </Box>
                    {m.contacts > 0 && <Box component="span" sx={{ display: "block", fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{many(m.contacts, "contact", "contacts")}</Box>}
                  </Box>
                  {isOpen ? <ExpandLessIcon sx={{ fontSize: 20, color: MUTED }} /> : <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED }} />}
                </Box>
                {isOpen && <MoveCompanies key={`${m.key}|${fetchCountry ?? ""}`} from={m.from} to={m.to} country={fetchCountry} d={d} names={names} />}
              </Box>
            );
          })}
        </Box>
        {pager}
        {!moves.length && (
          <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>
            {person !== null ? `Nothing moves to or from ${personName} in ${where}.` : "Nothing to change here."}
          </Typography>
        )}
      </GlassCard>
    </>
  );
}
