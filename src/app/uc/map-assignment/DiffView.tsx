"use client";

// MAP ASSIGNMENT - the differences, grouped by WHY (SARCLA 20.10.2026, after "9,200 companies would change owner - TSA
// Team gets 7,892 ...": "Why these differences - it's where I get really lost. Let's do the first batch of difference
// logic so I can understand per topic and give my ok"). One card per topic (src/lib/mapAssign/topics.ts, first match
// wins): a plain title, one sentence why, how many, where, the biggest moves, 5 examples, and the OK (admins) - an OK is
// for the topic as it is now, flagged when its count moves by more than 10% since. Rules change on the map (#map).
// From GET ?topics=1&country=; an OK is PUT {topicOk: {topic, ok}}. Below, folded: the moves by person as before
// (d.moves, complete over the whole table; a move's companies from GET ?changes=1, 50 at a time).

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
import PublicOffOutlinedIcon from "@mui/icons-material/PublicOffOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import WrongLocationOutlinedIcon from "@mui/icons-material/WrongLocationOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PinDropOutlinedIcon from "@mui/icons-material/PinDropOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloseIcon from "@mui/icons-material/Close";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, AMBER, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, clip, headCell, type Tint } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { ChangesPage, CompanyChange, MapData } from "@/lib/mapAssign/api";
import type { OwnerId } from "@/lib/mapAssign/rules";
import type { TopicId, TopicStat, TopicsData } from "@/lib/mapAssign/topics";
import { API, FLAG_LABEL, Swatch, VIA_LABEL, countryName, hsCompany, send, type Names, type Palette } from "./shared";

/** Country pills shown before the rest go behind "more". */
const TOP = 8;
const PAGE = 50;
/** Per-country chips on a topic card (all countries) before "+N more". */
const CHIPS = 10;
/** a move's companies from md up: company, where, why, contacts off, written */
const COLS = "minmax(0, 1.3fr) minmax(0, 0.8fr) minmax(0, 1.5fr) 100px 130px";

const TOPIC_LOOK: Record<TopicId, { icon: React.ReactNode; tint: Tint }> = {
  "no-country": { icon: <PublicOffOutlinedIcon />, tint: "slate" },
  left: { icon: <PersonOffOutlinedIcon />, tint: "pink" },
  region: { icon: <AssignmentIndOutlinedIcon />, tint: "blue" },
  contacts: { icon: <GroupsOutlinedIcon />, tint: "green" },
  "sae-nobody": { icon: <HelpOutlineOutlinedIcon />, tint: "amber" },
  "sae-elsewhere": { icon: <WrongLocationOutlinedIcon />, tint: "amber" },
  rule1: { icon: <BadgeOutlinedIcon />, tint: "purple" },
  rule2: { icon: <PinDropOutlinedIcon />, tint: "blue" },
  key: { icon: <KeyOutlinedIcon />, tint: "purple" },
  redirection: { icon: <AltRouteOutlinedIcon />, tint: "slate" },
  other: { icon: <HelpOutlineOutlinedIcon />, tint: "slate" },
};

type Move = { key: string; from: OwnerId | null; to: OwnerId; companies: number; contacts: number; countries: { cc: string; companies: number }[] };
type Person = { key: string; id: OwnerId | null; gets: number; gives: number; net: number };

/** "" = nobody (no owner now) - as the route's from="" */
const pkey = (id: OwnerId | null | undefined) => (id ? String(id) : "");
/** the owner is right already: only region responsibility or contacts to fix */
const same = (m: { from: OwnerId | null; to: OwnerId }) => pkey(m.from) === pkey(m.to);
const many = (n: number, one: string, more: string) => `${full(n)} ${n === 1 ? one : more}`;
const signed = (n: number) => (n > 0 ? `+${full(n)}` : n < 0 ? `−${full(-n)}` : "±0");
/** "20.10" */
const day = (iso: string) => when(iso).split(" ")[0];
const ccShort = (cc: string | null) => (!cc || cc === "??" ? "no country" : cc);
const subhead = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.08em", mb: 0.75 };

function Written({ c, live }: { c: CompanyChange; live: boolean }) {
  if (c.wrote) return c.wrote.ok
    ? <Chip tint="green">written {when(c.wrote.at)}</Chip>
    : <Typography component="span" sx={{ fontSize: "0.76rem", color: RED }} title={c.wrote.error ?? ""}>failed{c.wrote.error ? `: ${c.wrote.error}` : ""}</Typography>;
  return live ? <Chip tint="amber">next scan</Chip> : <Chip tint="slate">shadow</Chip>;
}

function Who({ id, names, palette, strong = false, empty = "No owner" }: { id: OwnerId | null; names: Names; palette: Palette; strong?: boolean; empty?: string }) {
  const left = !!id && !names.active(id);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, minWidth: 0, maxWidth: "100%" }}>
      <Swatch paint={palette(id)} />
      <Box component="span" sx={{ fontSize: "0.86rem", fontWeight: strong ? 700 : 600, color: id ? INK : MUTED, ...clip(240) }} title={id ? names.name(id) : empty}>
        {id ? names.name(id) : empty}
      </Box>
      {left && <Box component="span" sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>has left</Box>}
    </Box>
  );
}

/* ── the topics ── */

/** The OK of one topic: given (green, with Undo), changed since (amber, OK again), or not yet. */
function OkButtons({ t, admin, busy, filtered, onAnswer }: { t: TopicStat; admin: boolean; busy: boolean; filtered: boolean; onAnswer: (ok: boolean) => void }) {
  const ok = t.ok;
  const given = ok ? `OK given ${day(ok.at)}${ok.by ? ` by ${ok.by}` : ""}` : "";
  const undo = (
    <Button size="small" disabled={busy} onClick={() => onAnswer(false)} sx={{ textTransform: "none", color: MUTED, minWidth: 0, px: 1 }}>Undo</Button>
  );
  const rules = (
    <Button size="small" href="#map" onClick={() => window.scrollTo({ top: 0 })} startIcon={<TuneOutlinedIcon sx={{ fontSize: 16 }} />}
      sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Change the rules</Button>
  );
  if (!admin) return ok ? <Box><Chip tint={ok.changed ? "amber" : "green"}>{ok.changed ? `Changed since the OK of ${day(ok.at)}` : given}</Chip></Box> : null;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {ok && !ok.changed ? (
          <Box role="status" sx={{
            display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.55, borderRadius: "10px", bgcolor: GREEN, color: "#ffffff",
            fontSize: "0.8125rem", fontWeight: 600, maxWidth: "100%", minWidth: 0,
          }}>
            <CheckIcon sx={{ fontSize: 16 }} />
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{given}</Box>
          </Box>
        ) : (
          <Button size="small" variant={ok ? "contained" : "outlined"} disableElevation disabled={busy} onClick={() => onAnswer(true)}
            startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", ...(ok ? { bgcolor: AMBER, "&:hover": { bgcolor: "#8a560e" } } : { color: GREEN, borderColor: GREEN, "&:hover": { borderColor: GREEN, bgcolor: "rgba(27,122,85,.06)" } }) }}>
            {ok ? "OK again" : "OK"}
          </Button>
        )}
        {ok && undo}
        {rules}
        {busy && <CircularProgress size={14} />}
      </Box>
      {ok?.changed && (
        <Typography sx={{ fontSize: "0.76rem", color: AMBER }}>
          Changed since your OK of {day(ok.at)}{ok.by ? ` (${ok.by})` : ""}: {full(ok.companies)} companies then, {full(t.all)} now. Your OK is kept - look again and give it again.
        </Typography>
      )}
      {filtered && (
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Your OK covers this topic in every country: {many(t.all, "company", "companies")}.</Typography>
      )}
    </Box>
  );
}

function TopicCard({ t, all, admin, busy, onAnswer, names, palette }: {
  t: TopicStat; all: boolean; admin: boolean; busy: boolean; onAnswer: (ok: boolean) => void; names: Names; palette: Palette;
}) {
  const look = TOPIC_LOOK[t.topic] ?? TOPIC_LOOK.other;
  const restCountries = t.countries.length - CHIPS;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={look.icon} tint={look.tint} title={t.title} note={t.why} />
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mt: -1, mb: 1.5 }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(t.companies)}</Typography>
        <Typography sx={{ fontSize: "0.92rem", color: INK, fontWeight: 600 }}>{t.companies === 1 ? "company" : "companies"}</Typography>
        {t.contacts > 0 && <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>· {many(t.contacts, "contact follows", "contacts follow")}</Typography>}
      </Box>
      {all && t.countries.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
          {t.countries.slice(0, CHIPS).map((c) => <Chip key={c.country} tint="slate">{ccShort(c.country)} {full(c.companies)}</Chip>)}
          {restCountries > 0 && <Chip tint="slate">+{restCountries} more</Chip>}
        </Box>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 3 }, mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={subhead}>{t.kind === "region" ? "Region responsibility now → by the rules" : t.kind === "contacts" ? "Whose contacts follow" : "Biggest moves"}</Typography>
          {t.moves.map((m) => (
            <Box key={`${pkey(m.from)}>${m.to}`} sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", py: 0.6, borderTop: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
              {t.kind !== "contacts" && (
                <>
                  <Who id={m.from} names={names} palette={palette} empty={t.kind === "region" ? "Empty" : "No owner"} />
                  <ArrowForwardIcon sx={{ fontSize: 15, color: FAINT }} titleAccess="to" />
                </>
              )}
              <Who id={m.to} names={names} palette={palette} strong />
              <Box component="span" sx={{ fontSize: "0.86rem", color: INK, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                · {full(m.companies)}
                {t.kind === "contacts" && m.contacts > 0 && <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}> ({many(m.contacts, "contact", "contacts")})</Box>}
              </Box>
            </Box>
          ))}
          {t.more.moves > 0 && (
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, pt: 0.6, borderTop: `1px solid ${HAIRLINE}` }}>
              + {many(t.more.moves, "smaller move", "smaller moves")} · {many(t.more.companies, "company", "companies")}
            </Typography>
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={subhead}>For example</Typography>
          {t.examples.map((e) => (
            <Box key={e.id} sx={{ py: 0.6, borderTop: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
              <Box component="a" href={hsCompany(e.id)} target="_blank" rel="noopener" title={e.name}
                sx={{ color: INK, fontWeight: 600, fontSize: "0.84rem", textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</Box>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.sae ?? ""}>
                {ccShort(e.country)} · {e.zip || "no zip code"} · {e.sae ? `SAE ${e.sae}` : "no SAE"}
                {t.kind === "contacts" && e.contacts ? ` · ${many(e.contacts, "contact", "contacts")}` : ""}
              </Typography>
              {t.kind !== "contacts" && (
                <Typography sx={{ fontSize: "0.76rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.from ? names.name(e.from) : t.kind === "region" ? "Empty" : "No owner"} → {names.name(e.to)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>
      <OkButtons t={t} admin={admin} busy={busy} filtered={!all && t.all !== t.companies} onAnswer={onAnswer} />
    </GlassCard>
  );
}

/* ── all moves by person (the Differences view before the topics, folded under them) ── */

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

/** Who gains, who loses + every move, in the country the topics show ("all" = every country). */
function AllMoves({ d, names, palette, cc }: { d: MapData; names: Names; palette: Palette; cc: string }) {
  const all = d.moves ?? [];
  const [person, setPerson] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const inCountry = useMemo(() => all.filter((m) => cc === "all" || m.country === cc), [all, cc]);

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
  const pickPerson = (k: string) => { setPerson((cur) => (cur === k ? null : k)); setOpen(null); setPage(0); };

  const where = cc === "all" ? "all countries" : countryName(cc);
  const personName = person === null ? "" : person ? names.name(person) : "No owner";
  return (
    <>
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

/* ── the view ── */

export function DiffView({ d, names, palette }: { d: MapData; names: Names; palette: Palette }) {
  const [country, setCountry] = useState<string>("all");
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState<TopicId | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [folded, setFolded] = useState(true);
  const url = `${API}?${new URLSearchParams({ topics: "1", ...(country !== "all" ? { country } : {}), ...(n ? { n: String(n) } : {}) }).toString()}`;
  const held = useHeld<TopicsData>(url, [url]);
  const r = held.result;
  const t = r?.state === "ok" && r.data && Array.isArray((r.data as Partial<TopicsData>).topics) ? r.data : null;

  // a country that has nothing left (after a scan or a rules change): back to all
  useEffect(() => {
    if (t && !held.stale && country !== "all" && !t.countries.some((c) => c.country === country)) setCountry("all");
  }, [t, held.stale, country]);

  const answer = async (topic: TopicId, ok: boolean) => {
    setBusy(topic); setErr(null);
    const res = await send("PUT", { topicOk: { topic, ok, ...(country !== "all" ? { country } : {}) } });
    setBusy(null);
    if (!res.ok) setErr(`The answer was not saved: ${res.error ?? "?"}`);
    setN((x) => x + 1);
  };

  if (r === null) return <LoadingPanel label="Grouping the differences by why…" />;
  if (!t) {
    return r.state === "ok"
      ? <Info>The topics are not there yet - this view fills in once the hub is deployed.</Info>
      : <UpstreamPanel source="Differences" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  }

  const cc = country;
  if (cc === "all" && !t.topics.length) {
    return d.last
      ? <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}><CardTitle icon={<CompareArrowsOutlinedIcon />} tint="green" title="Nothing to change" note={`Every company has the owner the rules give it - last scan ${when(d.last.at)}`} /></GlassCard>
      : <Info>No scan yet - the differences appear after the first one.</Info>;
  }

  const top = t.countries.slice(0, TOP), rest = t.countries.slice(TOP);
  const allCompanies = t.countries.reduce((a, c) => a + c.companies, 0);
  const keepOwner = t.total.companies - t.total.changeOwner;
  const liveCount = Object.values(d.live).filter(Boolean).length;
  const inWhere = cc === "all" ? "" : cc === "??" ? " without a country" : ` in ${countryName(cc)}`;
  const pickCountry = (v: string) => { setCountry(v || "all"); setErr(null); };
  return (
    <>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber"
          title={`${many(t.total.changeOwner, "company", "companies")} would change owner${inWhere} - grouped by why`}
          note={`Counted with the saved rules (Live, not the sandbox), again at every save. The OK on a topic records that you agree with what the rules give there - it writes nothing; nothing is written while a country is in shadow.${d.last ? ` Last scan ${when(d.last.at)}.` : ""}`}
          right={cc === "all" ? (liveCount ? <Chip tint="pink">{liveCount} live</Chip> : <Chip tint="slate">all shadow</Chip>) : d.live[cc] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>} />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <Choice<string> value={cc} onChange={pickCountry} options={[
            { key: "all", label: `All · ${full(allCompanies)}` },
            ...top.map((c) => ({ key: c.country, label: `${countryName(c.country)} · ${full(c.companies)}` })),
          ]} />
          {rest.length > 0 && (
            <Select size="small" displayEmpty value={rest.some((c) => c.country === cc) ? cc : ""} onChange={(e) => pickCountry(e.target.value)}
              inputProps={{ "aria-label": "More countries" }}
              sx={{ fontSize: "0.8rem", borderRadius: "999px", "& .MuiSelect-select": { py: 0.45, pl: 1.5 }, ...(rest.some((c) => c.country === cc) ? { color: ACCENT } : { color: MUTED }) }}>
              <MenuItem value="">{`${rest.length} more`}</MenuItem>
              {rest.map((c) => <MenuItem key={c.country} value={c.country}>{`${countryName(c.country)} · ${full(c.companies)}`}</MenuItem>)}
            </Select>
          )}
          {held.stale && <CircularProgress size={14} sx={{ color: MUTED }} />}
        </Box>
        {keepOwner > 0 && (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 1.5 }}>
            {many(keepOwner, "more company keeps its", "more companies keep their")} owner - only the Region responsibility or the contacts to fix. The country counts above hold both.
          </Typography>
        )}
      </GlassCard>

      {err && <Notice tone="bad">{err}</Notice>}

      <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, opacity: held.stale ? 0.6 : 1, transition: "opacity .15s" }}>
        {t.topics.map((x) => (
          <TopicCard key={x.topic} t={x} all={cc === "all"} admin={d.admin} busy={busy === x.topic} onAnswer={(ok) => void answer(x.topic, ok)} names={names} palette={palette} />
        ))}
        {!t.topics.length && <Info>Nothing differs{inWhere} any more - the next scan updates the counts.</Info>}
      </Box>

      <GlassCard sx={{ p: 0 }}>
        <Box component="button" type="button" onClick={() => setFolded((x) => !x)} aria-expanded={!folded} sx={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.5, width: "100%", minWidth: 0,
          px: { xs: 2, md: 2.5 }, py: 1.75, borderRadius: "22px", "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
        }}>
          <SwapHorizOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
            <Box component="span" sx={{ display: "block", fontSize: "0.98rem", fontWeight: 600, color: INK }}>All moves by person</Box>
            <Box component="span" sx={{ display: "block", fontSize: "0.8rem", color: MUTED }}>Who gains, who loses, and every move with its companies{inWhere}</Box>
          </Box>
          {folded ? <ExpandMoreIcon sx={{ fontSize: 22, color: MUTED }} /> : <ExpandLessIcon sx={{ fontSize: 22, color: MUTED }} />}
        </Box>
      </GlassCard>
      {!folded && <AllMoves key={cc} d={d} names={names} palette={palette} cc={cc} />}
    </>
  );
}

