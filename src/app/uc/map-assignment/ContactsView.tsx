"use client";

// MAP ASSIGNMENT - Contacts (SARCLA 21.10.2026: "instead of Differences I want to see the KPI of new contacts entering
// the assignment - to whom, if it hit the rules or not - and also the contact association: every contact associated to
// a company matches the same as in the company"). Top to bottom:
//   Contacts follow their company (SARCLA 24.10.2026: "the steering module for the contact associations - when a
//     contact's properties differ from the company's it should be corrected instantly as associated"): how many differ
//     (the nightly read), per country, "Correct now" and the Automatic switch (admins), the last pass
//   New contacts - last 30 days: how many, the share that follows the rules, a bar per day, by person (the company's
//     owner by the rules), by rule, the latest that do not follow - counted at most hourly by the engine's run - with
//     "Correct the N sure ones" (24.10.2026: "if we are 100% sure that they don't follow the rules")
//   Contacts match their company: per country and per person, the share of associated contacts with the company's
//     owner + region in HubSpot now, and with the owner by the rules (the table's counts, from the nightly full read)
//   Differences by topic, folded: the former Differences view (DiffView), unchanged
// From GET ?contacts=1 (src/lib/mapAssign/contactsKpi.ts) - the page loads it once, its tab shows the share.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useHeld, type Held } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Notice, RED, TRACK, clip, headCell, type Tint } from "@/app/uc/report/ui";
import { Chip, Choice, Info, when } from "@/app/connectors/parts";
import type { MapData } from "@/lib/mapAssign/api";
import type {
  ClassCounts, ContactClass, ContactMatch, ContactsData, DayCount, MatchCounts, NewContactExample, NewContactsKpi, NewContactsPart, NotSureCounts, RuleKey,
} from "@/lib/mapAssign/contactsKpi";
import type { ContactFollow, FollowLast } from "@/lib/mapAssign/follow";
import { DiffView } from "./DiffView";
import { API, Swatch, countryName, hsCompany, hsContact, send, type Names, type Palette } from "./shared";

/* ── the data ── */

/** GET ?contacts=1, held while it reloads. */
export function useContactsData(n: number, k = 0): Held<ContactsData> {
  // k: the Contacts view reads again by itself while a pass is going (the page's n reads everything again)
  const url = `${API}?contacts=1${n ? `&n=${n}` : ""}${k ? `&k=${k}` : ""}`;
  return useHeld<ContactsData>(url, [url]);
}
/** The data when the route answered with it (a hub without this route answers ?contacts=1 with the map's data). */
export function contactsOf(h: Held<ContactsData>): ContactsData | null {
  const r = h.result;
  if (r?.state !== "ok") return null;
  const x = r.data as Partial<ContactsData> | null;
  return x && x.match && Array.isArray(x.match.byCountry) ? (x as ContactsData) : null;
}

/** Of the new contacts whose company is known, the share that follows the rules (0..1); null = none known. */
const followShare = (c: ClassCounts): number | null => {
  const known = c.follows + c["follows-company"] + c.differs;
  return known ? c.follows / known : null;
};
/** A share as a whole percent - never 100 unless all, never 0 unless none. */
const pctNum = (s: number) => { const r = Math.round(s * 100); return s < 1 && r === 100 ? 99 : s > 0 && r === 0 ? 1 : r; };
const pct = (s: number | null) => (s === null ? "—" : `${pctNum(s)}%`);
/** The tab's badge: the share of new contacts that follow the rules, in %; null = not known yet. */
export function followPct(h: Held<ContactsData>): number | null {
  const k = contactsOf(h)?.newContacts;
  const s = k ? followShare(k.classes) : null;
  return s === null ? null : pctNum(s);
}
/** Of the contacts counted, the share that do not differ (0..1); null = none counted. */
const matchShare = (counted: number, differ: number): number | null =>
  counted > 0 ? Math.max(0, Math.min(1, 1 - Math.max(0, differ) / counted)) : null;

/* ── words and colours ── */

/** The bars: the four states (no company and not read yet together, in grey). */
type Seg = "follows" | "follows-company" | "differs" | "none";
const SEGS: { key: Seg; label: string; color: string }[] = [
  { key: "follows", label: "Follow the rules", color: "#1f9d63" },
  { key: "follows-company", label: "Follow their company - the company is not right yet", color: "#eda100" },
  { key: "differs", label: "Another owner or region than their company", color: "#d03b3b" },
  { key: "none", label: "No company yet", color: "#b4bcc8" },
];
const segOf = (c: ClassCounts, k: Seg) => (k === "none" ? c["no-company"] + c["unknown-company"] : c[k]);
/** The same, as a day's readout says them. */
const SEG_SHORT: Record<Seg, string> = { follows: "follow the rules", "follows-company": "follow their company", differs: "another owner or region", none: "no company yet" };

const KIND: Record<ContactClass, { label: string; tint: Tint }> = {
  follows: { label: "Follows the rules", tint: "green" },
  "follows-company": { label: "Follows its company - not right yet", tint: "amber" },
  differs: { label: "Another owner or region", tint: "pink" },
  "unknown-company": { label: "Company not read yet", tint: "slate" },
  "no-company": { label: "No company yet", tint: "slate" },
};
const RULE_LABEL: Record<RuleKey, string> = {
  rule1: "Rule 1 · Performis SAE", rule2: "Rule 2 · zip code", key: "Key accounts", redirection: "Owner redirection",
  other: "Something else", "unknown-company": "Company not read yet", "no-company": "No company yet",
};

const many = (n: number, one: string, more: string) => `${full(n)} ${n === 1 ? one : more}`;
/** "21.10" */
const dm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const subhead = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.08em", mb: 0.75 };
const link = { color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const num = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: "right" as const, whiteSpace: "nowrap" as const };
const note = { fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 };

function Person({ id, names, palette, empty = "No company yet" }: { id: string | null; names: Names; palette: Palette; empty?: string }) {
  const left = !!id && !names.active(id);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, minWidth: 0, maxWidth: "100%" }}>
      <Swatch paint={palette(id || null)} />
      <Box component="span" sx={{ fontSize: "0.84rem", fontWeight: 600, color: id ? INK : MUTED, ...clip(260) }} title={id ? names.name(id) : empty}>{id ? names.name(id) : empty}</Box>
      {left && <Box component="span" sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>has left</Box>}
    </Box>
  );
}

/** A share as a figure and, from sm up, a small meter. */
function Share({ s, title }: { s: number | null; title?: string }) {
  return (
    <Box title={title} sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.75, minWidth: 0 }}>
      <Box component="span" sx={{ display: { xs: "none", sm: "block" }, width: 40, height: 6, borderRadius: 3, bgcolor: TRACK, overflow: "hidden", flexShrink: 0 }}>
        {s !== null && <Box component="span" sx={{ display: "block", height: "100%", width: `${Math.round(s * 100)}%`, bgcolor: "#1f9d63", borderRadius: 3 }} />}
      </Box>
      <Box component="span" sx={{ ...num, color: s === null ? MUTED : INK, minWidth: 34 }}>{pct(s)}</Box>
    </Box>
  );
}

/** A compact table: header + rows on one grid, the first column takes what is left. */
function Rows({ cols, head, rows, more }: { cols: object; head: string[]; rows: React.ReactNode[][]; more?: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 1, px: 0.5, pb: 0.6, borderBottom: `1px solid ${HAIRLINE}` }}>
        {head.map((h, i) => <Box key={h || i} sx={{ ...headCell, textAlign: i ? "right" : "left", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</Box>)}
      </Box>
      {rows.map((r, i) => (
        <Box key={i} sx={{ display: "grid", gridTemplateColumns: cols, gap: 1, px: 0.5, py: 0.7, borderBottom: `1px solid ${HAIRLINE}`, alignItems: "center", minWidth: 0 }}>
          {r.map((c, j) => <Box key={j} sx={{ minWidth: 0 }}>{c}</Box>)}
        </Box>
      ))}
      {more}
    </Box>
  );
}
function MoreButton({ all, n, onClick }: { all: boolean; n: number; onClick: () => void }) {
  return <Button size="small" onClick={onClick} sx={{ textTransform: "none", mt: 0.5 }}>{all ? "Show fewer" : `Show all ${n}`}</Button>;
}

/* ── new contacts ── */

/** A bar per day, the four states stacked; pointing at (or tapping) a day reads it out above. */
function DayBars({ p }: { p: NewContactsPart }) {
  const [at, setAt] = useState<number | null>(null);
  const days = p.perDay;
  const max = Math.max(1, ...days.map((x) => x.total));
  const H = 120;
  /** px per contact, the same for every day (room for the 2px gaps of four parts) */
  const scale = (H - 8) / max;
  const partsOf = (x: DayCount) => SEGS.map((s) => ({ s, n: segOf(x.classes, s.key) })).filter((y) => y.n > 0);
  const say = (x: DayCount) => `${many(x.total, "new contact", "new contacts")}${x.total ? ` - ${partsOf(x).map(({ s, n }) => `${full(n)} ${SEG_SHORT[s.key]}`).join(", ")}` : ""}`;
  const d = days[at ?? days.length - 1];
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.8rem", color: INK, minHeight: "2.4em", mb: 0.5 }} aria-live="polite">
        {d ? <><b>{at === null ? `Today, ${dm(d.day)}` : dm(d.day)}</b>: {say(d)}</> : null}
      </Typography>
      <Box role="group" aria-label="New contacts per day" onMouseLeave={() => setAt(null)}
        sx={{ position: "relative", display: "flex", alignItems: "flex-end", gap: "2px", height: H, borderBottom: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
        {/* the day with the most, as a faint line */}
        <Box aria-hidden sx={{ position: "absolute", left: 0, right: 0, top: 0, borderTop: `1px dashed ${HAIRLINE}` }} />
        <Typography aria-hidden sx={{ position: "absolute", top: 2, left: 0, fontSize: "0.68rem", color: FAINT, bgcolor: "rgba(255,255,255,.7)", px: 0.25, lineHeight: 1.2 }}>{full(max)}</Typography>
        {days.map((x, i) => {
          const parts = partsOf(x);
          return (
            <Box key={x.day} component="button" type="button" aria-label={`${dm(x.day)}: ${say(x)}`} title={`${dm(x.day)}: ${say(x)}`}
              onMouseEnter={() => setAt(i)} onFocus={() => setAt(i)} onClick={() => setAt(i)}
              sx={{
                all: "unset", cursor: "pointer", flex: "1 1 0", minWidth: 0, height: "100%", display: "flex", flexDirection: "column-reverse", gap: "2px",
                borderRadius: "3px 3px 0 0", bgcolor: at === i ? "rgba(21,34,58,.05)" : "transparent", "&:focus-visible": { outline: `2px solid ${ACCENT}` },
              }}>
              {parts.map((y, j) => (
                <Box key={y.s.key} component="span" sx={{
                  display: "block", flexShrink: 0, height: `${Math.max(2, y.n * scale)}px`, bgcolor: y.s.color,
                  borderRadius: j === parts.length - 1 ? "3px 3px 0 0" : 0,
                }} />
              ))}
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: FAINT, mt: 0.4 }}>
        <span>{days.length ? dm(days[0].day) : ""}</span>
        <span>{days.length > 2 ? dm(days[Math.floor(days.length / 2)].day) : ""}</span>
        <span>{days.length ? dm(days[days.length - 1].day) : ""}</span>
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, rowGap: 0.5, flexWrap: "wrap", mt: 1 }}>
        {SEGS.map((s) => (
          <Box key={s.key} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.76rem", color: INK, minWidth: 0 }}>
            <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: s.color, flexShrink: 0 }} />
            <span>{s.label}</span>
            <Box component="span" sx={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{full(segOf(p.classes, s.key))}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

const PERSON_COLS = { xs: "minmax(0, 1fr) 44px 64px", sm: "minmax(0, 1fr) 52px 96px" };
const TOP_PEOPLE = 10;

function ByPerson({ p, names, palette }: { p: NewContactsPart; names: Names; palette: Palette }) {
  const [all, setAll] = useState(false);
  const list = all ? p.byPerson : p.byPerson.slice(0, TOP_PEOPLE);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={subhead}>By person - the company's owner by the rules</Typography>
      <Rows cols={PERSON_COLS} head={["Person", "New", "Follow"]}
        rows={list.map((x) => [
          <Person key="p" id={x.owner || null} names={names} palette={palette} />,
          <Box key="n" sx={num}>{full(x.n)}</Box>,
          x.owner ? <Share key="s" s={x.n ? x.follows / x.n : null} title={`${full(x.follows)} of ${full(x.n)} follow the rules`} /> : <Box key="s" sx={{ ...num, color: MUTED }}>—</Box>,
        ])}
        more={p.byPerson.length > TOP_PEOPLE ? <MoreButton all={all} n={p.byPerson.length} onClick={() => setAll((v) => !v)} /> : undefined} />
    </Box>
  );
}

function ByRule({ p }: { p: NewContactsPart }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={subhead}>By rule - how the company got its owner</Typography>
      <Rows cols={PERSON_COLS} head={["Rule", "New", "Follow"]}
        rows={p.byRule.map((x) => {
          const none = x.rule === "no-company" || x.rule === "unknown-company";
          return [
            <Box key="r" sx={{ fontSize: "0.84rem", fontWeight: 600, color: none ? MUTED : INK, ...clip(260) }}>{RULE_LABEL[x.rule] ?? x.rule}</Box>,
            <Box key="n" sx={num}>{full(x.n)}</Box>,
            none ? <Box key="s" sx={{ ...num, color: MUTED }}>—</Box> : <Share key="s" s={x.n ? x.follows / x.n : null} title={`${full(x.follows)} of ${full(x.n)} follow the rules`} />,
          ];
        })} />
    </Box>
  );
}

const LATEST_SHOWN = 8;

/** The not sure ones, by why, as one short phrase. */
const NOT_SURE_LABEL: Record<keyof NotSureCounts, string> = {
  company: "their company differs from the rules", "unknown-company": "company not read yet", "no-company": "no company",
};
const notSureSays = (n: NotSureCounts) => (Object.keys(NOT_SURE_LABEL) as (keyof NotSureCounts)[]).filter((k) => n[k] > 0).map((k) => `${full(n[k])} ${NOT_SURE_LABEL[k]}`).join(" · ");

/** "Correct the N sure ones" (SARCLA 24.10.2026): the counts for all countries (what the button corrects) and for the
 *  country picked. */
type SureProps = { latest: ContactFollow["latest"]; running: boolean; acts: Acts; part: Pick<NewContactsPart, "sure" | "notSure">; where: string };

function SureLine({ s }: { s: SureProps }) {
  const { latest, acts } = s;
  if (!latest.known) return <Typography sx={{ ...note, mb: 0.75 }}>Which of them are sure to correct is counted from the next hourly count.</Typography>;
  const here = s.where && typeof s.part.sure === "number" ? ` - ${full(s.part.sure)} of them${s.where}` : "";
  return (
    <Box sx={{ display: "grid", gap: 0.4, mb: 1 }}>
      <Typography sx={note}>
        <b>Sure</b>: the company already has the owner and region responsibility the rules give it - the contact then takes the company's.
        {" "}{latest.sure ? `${many(latest.sure, "sure one", "sure ones")} in all countries${here}.` : "None is sure right now."}
      </Typography>
      {latest.notSure > 0 && (
        <Typography sx={note}>
          <b>Not sure - the company first</b>: {full(latest.notSure)}{latest.why ? ` (${notSureSays(latest.why)})` : ""}. Never written from here.
        </Typography>
      )}
      {acts.msg?.at === "latest" && <Typography sx={{ fontSize: "0.8rem", color: acts.msg.ok ? "#1b7a55" : RED }}>{acts.msg.text}</Typography>}
    </Box>
  );
}

function Latest({ list, names, sure }: { list: NewContactExample[]; names: Names; sure?: SureProps }) {
  const [all, setAll] = useState(false);
  const n = sure?.latest.known ? sure.latest.sure : 0;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.75 }}>
        <Typography sx={{ ...subhead, mb: 0, mr: "auto" }}>The latest that do not follow the rules</Typography>
        {sure?.acts.admin && n > 0 && (
          <Button size="small" variant="outlined" startIcon={sure.acts.busy === "latest" ? <CircularProgress size={12} /> : <AutoFixHighOutlinedIcon />}
            disabled={sure.acts.busy !== null || sure.running} onClick={() => sure.acts.ask("latest")} sx={{ textTransform: "none" }}>
            {`Correct the ${many(n, "sure one", "sure ones")}`}
          </Button>
        )}
      </Box>
      {sure && <SureLine s={sure} />}
      {(all ? list : list.slice(0, LATEST_SHOWN)).map((e) => {
        const ownerRight = !!e.decided && String(e.owner ?? "") === String(e.decided);
        return (
          <Box key={e.id} sx={{ py: 0.8, borderTop: `1px solid ${HAIRLINE}`, minWidth: 0, display: "grid", gap: 0.2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Box component="a" href={hsContact(e.id)} target="_blank" rel="noopener" title={e.email ?? e.id} sx={{ ...link, fontSize: "0.84rem", flex: 1, minWidth: 0 }}>
                {e.email || `Contact ${e.id}`}
              </Box>
              {e.sure && <Chip tint="green">Sure</Chip>}
              <Chip tint={KIND[e.kind].tint}>{KIND[e.kind].label}</Chip>
            </Box>
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline", minWidth: 0, fontSize: "0.76rem", color: MUTED }}>
              <Box component="span" sx={{ whiteSpace: "nowrap" }}>{e.created ? when(e.created) : "—"}</Box>
              {e.companyId && (
                <Box component="a" href={hsCompany(e.companyId)} target="_blank" rel="noopener" title={e.companyName ?? e.companyId}
                  sx={{ ...link, fontWeight: 500, color: MUTED, minWidth: 0 }}>{e.companyName || `Company ${e.companyId}`}</Box>
              )}
              {e.country && <Box component="span" sx={{ whiteSpace: "nowrap" }}>{e.country}</Box>}
            </Box>
            {e.decided ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", fontSize: "0.78rem", color: INK, minWidth: 0 }}>
                {ownerRight ? (
                  <>
                    <span>Owner right - region responsibility {e.region ? names.name(e.region) : "empty"}</span>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: FAINT }} titleAccess="should be" />
                    <b>{names.name(e.decided)}</b>
                  </>
                ) : (
                  <>
                    <span>{e.owner ? names.name(e.owner) : "No owner"}</span>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: FAINT }} titleAccess="by the rules" />
                    <b>{names.name(e.decided)}</b>
                    {e.kind === "follows-company" && <Box component="span" sx={{ color: MUTED }}>(the company has {e.companyOwnerNow ? names.name(e.companyOwnerNow) : "no owner"} today)</Box>}
                  </>
                )}
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>The company is new - the next run reads it.</Typography>
            )}
          </Box>
        );
      })}
      {list.length > LATEST_SHOWN && <MoreButton all={all} n={list.length} onClick={() => setAll((v) => !v)} />}
      {!list.length && <Typography sx={{ ...note, py: 0.5 }}>Every new contact with a company follows the rules.</Typography>}
    </Box>
  );
}

/** Country pills shown before the rest go behind "more". */
const TOP_COUNTRIES = 7;

function NewContactsCard({ k, names, palette, stale, sure }: {
  k: NewContactsKpi | null; names: Names; palette: Palette; stale: boolean;
  /** "Correct the N sure ones" - absent from an older hub */
  sure?: Omit<SureProps, "part" | "where">;
}) {
  const [cc, setCc] = useState("all");
  if (!k) {
    return (
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<PersonAddAlt1OutlinedIcon />} tint="green" title="New contacts - last 30 days" note="Whom they went to, and whether that is what the rules give their company" />
        <Info>Not counted yet - the map assignment run counts them once an hour, from its next run.</Info>
      </GlassCard>
    );
  }
  const countries = Object.entries(k.countries).map(([c, x]) => ({ cc: c, n: x.total })).sort((a, b) => b.n - a.n || a.cc.localeCompare(b.cc));
  const pick = cc !== "all" && k.countries[cc] ? cc : "all";
  const p: NewContactsPart = pick === "all" ? k : k.countries[pick];
  const top = countries.slice(0, TOP_COUNTRIES), rest = countries.slice(TOP_COUNTRIES);
  const known = p.classes.follows + p.classes["follows-company"] + p.classes.differs;
  const share = followShare(p.classes);
  const noCo = p.classes["no-company"], notRead = p.classes["unknown-company"];
  const where = pick === "all" ? "" : ` in ${countryName(pick)}`;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PersonAddAlt1OutlinedIcon />} tint="green" title="New contacts - last 30 days"
        note={`Whom they went to, and whether that is what the rules give their company. Counted every hour - last ${when(k.at)}.`}
        right={stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : undefined} />
      {countries.length > 1 && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", mb: 2 }}>
          <Choice<string> value={pick} onChange={(v) => setCc(v || "all")} options={[
            { key: "all", label: `All · ${full(k.total)}` },
            ...top.map((c) => ({ key: c.cc, label: `${countryName(c.cc)} · ${full(c.n)}` })),
          ]} />
          {rest.length > 0 && (
            <Select size="small" displayEmpty value={rest.some((c) => c.cc === pick) ? pick : ""} onChange={(e) => setCc(e.target.value || "all")}
              inputProps={{ "aria-label": "More countries" }}
              sx={{ fontSize: "0.8rem", borderRadius: "999px", "& .MuiSelect-select": { py: 0.45, pl: 1.5 }, color: rest.some((c) => c.cc === pick) ? ACCENT : MUTED }}>
              <MenuItem value="">{`${rest.length} more`}</MenuItem>
              {rest.map((c) => <MenuItem key={c.cc} value={c.cc}>{`${countryName(c.cc)} · ${full(c.n)}`}</MenuItem>)}
            </Select>
          )}
        </Box>
      )}
      {k.capped && <Notice tone="warn">HubSpot gives at most 10,000 contacts in one search - the oldest days here are short.</Notice>}

      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(p.total)}</Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK, fontWeight: 600 }}>new {p.total === 1 ? "contact" : "contacts"}{where}</Typography>
        {share !== null && (
          <Typography sx={{ fontSize: "0.95rem", color: INK, fontWeight: 600 }}>· <Box component="span" sx={{ color: "#1b7a55" }}>{pct(share)}</Box> follow the rules</Typography>
        )}
      </Box>
      <Typography sx={{ ...note, mb: 2 }}>
        {known ? `Of the ${full(known)} whose company is known` : "None has a known company yet"}
        {noCo ? ` · ${many(noCo, "has", "have")} no company yet (the No company tab)` : ""}
        {notRead ? ` · ${full(notRead)} with a company not read yet` : ""}
        {pick === "all" && k.internal ? ` · ${many(k.internal, "A+P person", "A+P people")} left out` : ""}
      </Typography>

      {p.total > 0 ? (
        <>
          <DayBars p={p} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 2.5, md: 3 }, mt: 2.5 }}>
            <ByPerson p={p} names={names} palette={palette} />
            <ByRule p={p} />
          </Box>
          <Box sx={{ mt: 2.5 }}><Latest list={p.examples} names={names} sure={sure ? { ...sure, part: p, where } : undefined} /></Box>
        </>
      ) : (
        <Typography sx={note}>No new contact{where} in the last 30 days.</Typography>
      )}
    </GlassCard>
  );
}

/* ── contacts against their company ── */

const MATCH_COLS = { xs: "minmax(0, 1fr) 64px 62px 50px", sm: "minmax(0, 1fr) 72px 104px 100px" };
const TOP_MATCH = 10;

const nowShare = (m: MatchCounts) => matchShare(m.mismCounted, m.mism);
const rulesShare = (m: MatchCounts) => matchShare(m.checked, m.off);

function MatchRows<T extends MatchCounts>({ title, list, label, all, setAll, total, mismKnown }: {
  title: string; list: T[]; label: (m: T) => React.ReactNode; all: boolean; setAll: (v: boolean) => void; total: number; mismKnown: boolean;
}) {
  const shown = all ? list : list.slice(0, TOP_MATCH);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={subhead}>{title}</Typography>
      <Rows cols={MATCH_COLS} head={["", "Contacts", "Company", "Rules"]}
        rows={shown.map((m) => [
          label(m),
          <Box key="n" sx={num}>{full(m.contacts)}</Box>,
          <Share key="c" s={mismKnown ? nowShare(m) : null} title={mismKnown && m.mismCounted ? `${full(m.mism)} of ${full(m.mismCounted)} contacts differ from their company` : "not counted yet"} />,
          <Share key="r" s={rulesShare(m)} title={m.checked ? `${full(m.off)} of ${full(m.checked)} checked contacts differ from the rules` : "not checked yet"} />,
        ])}
        more={total > TOP_MATCH ? <MoreButton all={all} n={total} onClick={() => setAll(!all)} /> : undefined} />
    </Box>
  );
}

function MatchCard({ m, names, palette }: { m: ContactMatch; names: Names; palette: Palette }) {
  const [allCountries, setAllCountries] = useState(false);
  const [allPeople, setAllPeople] = useState(false);
  const t = m.totals;
  const sNow = nowShare(t), sRules = rulesShare(t);
  const counted = m.mismKnown && t.companiesMism > 0;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<HubOutlinedIcon />} tint="blue" title="Contacts match their company"
        note={`Every contact associated to a company should have the company's owner and region responsibility. Counted on the nightly full read${m.countedAt ? ` - last ${when(m.countedAt)}` : ""}.`} />
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(t.contacts)}</Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK, fontWeight: 600 }}>contacts on {many(t.companiesCounted, "company", "companies")}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.92rem", color: INK, mb: 1 }}>
        {counted && <><b>{pct(sNow)}</b> have their company's owner and region today · </>}
        <b>{pct(sRules)}</b> of those checked have the owner the rules give their company
      </Typography>
      <Box sx={{ display: "grid", gap: 0.4, mb: 2 }}>
        <Typography sx={note}>
          <b>Company</b>: the same owner and region responsibility as their company in HubSpot today
          {!counted ? " - counted on the nightly full read, the first numbers come after the next one." : t.mismCounted < t.contacts ? ` - counted so far for ${full(t.mismCounted)} of ${full(t.contacts)} contacts, the rest on the next full read.` : "."}
        </Typography>
        <Typography sx={note}>
          <b>Rules</b>: the owner, region and SAE the rules give their company - checked for the companies whose owner would change and for live countries: {full(t.checked)} of {full(t.contacts)} contacts so far.
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
        <MatchRows title="By country" list={m.byCountry} total={m.byCountry.length} all={allCountries} setAll={setAllCountries} mismKnown={m.mismKnown}
          label={(x) => <Box sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, ...clip(260) }} title={countryName(x.country)}>{countryName(x.country)}</Box>} />
        <MatchRows title="By person - the company's owner by the rules" list={m.byOwner} total={m.byOwner.length} all={allPeople} setAll={setAllPeople} mismKnown={m.mismKnown}
          label={(x) => <Person id={x.owner || null} names={names} palette={palette} empty="Nobody" />} />
      </Box>
    </GlassCard>
  );
}

/* ── contacts follow their company (SARCLA 24.10.2026) ── */

/** What an admin can ask: a pass over every contact that differs, the sure ones of the latest, Automatic on / off. */
type FollowAct = "all" | "latest" | "auto-on" | "auto-off";
type Acts = {
  admin: boolean; busy: FollowAct | null;
  /** the answer, shown where it was asked */
  msg: { at: "card" | "latest"; ok: boolean; text: string } | null;
  /** a write asks first (Automatic off does not) */
  ask: (a: FollowAct) => void;
};

/** Country chips shown before the rest are "+N more". */
const FOLLOW_CHIPS = 8;
const PASS_NAME: Record<FollowLast["scope"], string> = { auto: "automatic", all: "Correct now", latest: "the sure ones", new: "new contacts" };

function lastSays(l: FollowLast): string {
  const who = l.scope === "auto" ? "" : `, ${l.by}`;
  return `Last pass ${when(l.at)} (${PASS_NAME[l.scope] ?? l.scope}${who}): ${full(l.checked)} checked, ${full(l.wrote)} corrected`
    + `${l.failed ? `, ${full(l.failed)} not taken by HubSpot` : ""}${l.left ? ` - ${full(l.left)} more next time` : ""}`
    + `${l.notSure ? ` · ${full(l.notSure)} not sure, left alone` : ""}.`;
}

function FollowCard({ f, acts }: { f: ContactFollow; acts: Acts }) {
  const p = f.pending;
  const countries = Object.entries(p.byCountry).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = countries.slice(0, FOLLOW_CHIPS), more = countries.length - top.length;
  const off = acts.busy !== null || f.running;
  const l = f.last;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PublishedWithChangesOutlinedIcon />} tint="purple" title="Contacts follow their company"
        note="A contact gets its company's owner and region responsibility in HubSpot - nothing else is touched. A+P people are left alone."
        right={f.auto ? <Chip tint="green">Automatic</Chip> : <Chip tint="slate">Automatic off</Chip>} />
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(p.contacts)}</Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK, fontWeight: 600 }}>
          {p.contacts === 1 ? "contact differs" : "contacts differ"} from their company{p.companies ? ` · in ${many(p.companies, "company", "companies")}` : ""}
        </Typography>
      </Box>
      <Typography sx={{ ...note, mb: 1.25 }}>
        {p.at ? `As of the nightly read ${when(p.at)} - each pass takes off what it corrects` : "Counted on the nightly read - the first numbers come after the next one"}
        {p.noOwner.contacts ? ` · ${many(p.noOwner.contacts, "contact", "contacts")} of ${many(p.noOwner.companies, "company", "companies")} with no owner left alone` : ""}.
      </Typography>
      {top.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", alignItems: "center", mb: 2 }}>
          {top.map(([cc, n]) => <Chip key={cc} tint="slate">{`${countryName(cc)} · ${full(n)}`}</Chip>)}
          {more > 0 && <Box component="span" sx={{ fontSize: "0.76rem", color: MUTED }}>+{more} more</Box>}
        </Box>
      )}
      {acts.admin ? (
        <Box sx={{ display: "grid", gap: 0.75, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Button variant="contained" disableElevation size="small" disabled={off || !p.contacts} onClick={() => acts.ask("all")}
              startIcon={acts.busy === "all" ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : <AutoFixHighOutlinedIcon />}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Correct now</Button>
            <FormControlLabel sx={{ m: 0 }} label={<Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>Automatic</Typography>}
              control={<Switch checked={f.auto} disabled={acts.busy !== null} onChange={(e) => acts.ask(e.target.checked ? "auto-on" : "auto-off")} />} />
            {(acts.busy === "auto-on" || acts.busy === "auto-off") && <CircularProgress size={14} />}
          </Box>
          <Typography sx={note}>
            When on, the hub corrects every 15 minutes - new contacts as they come, the rest a batch at a time (up to {full(f.cap)}). Nothing else is touched.
            {f.at && f.by ? ` Switched ${f.auto ? "on" : "off"} by ${f.by}, ${when(f.at)}.` : ""}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Admins can correct the contacts and switch Automatic on.</Typography>
      )}
      {acts.msg?.at === "card" && <Typography sx={{ fontSize: "0.82rem", color: acts.msg.ok ? "#1b7a55" : RED, mt: 1 }}>{acts.msg.text}</Typography>}
      <Box sx={{ display: "grid", gap: 0.3, mt: 1.25 }}>
        {/* a pass going: how far it is, read again by itself (SARCLA 24.10.2026: "A pass is going ... No pass yet - this is not moving") */}
        {f.running && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <CircularProgress size={12} sx={{ color: "#5b45c9" }} />
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>
              {f.now
                ? `Correcting now - started ${when(f.now.at)}${f.now.scope === "auto" ? "" : ` by ${f.now.by}`}: ${full(f.now.wrote)} ${f.now.wrote === 1 ? "contact" : "contacts"} corrected so far, ${many(f.now.companies, "company", "companies")} looked at${f.now.failed ? `, ${full(f.now.failed)} not taken by HubSpot` : ""}.`
                : "Correcting now - starting."}
              {" "}This line moves by itself.
            </Typography>
          </Box>
        )}
        {(l || !f.running) && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{l ? `${f.running ? "Before: " : ""}${lastSays(l)}` : "No pass yet - Correct now starts one."}</Typography>}
        {l?.error && !f.running && <Typography sx={{ fontSize: "0.8rem", color: RED }}>It stopped: {l.error}</Typography>}
      </Box>
    </GlassCard>
  );
}

/** Asked before a write: what it does, in a sentence or two. */
function FollowAsk({ a, f, busy, onCancel, onGo }: { a: FollowAct | null; f: ContactFollow | null; busy: boolean; onCancel: () => void; onGo: (a: FollowAct) => void }) {
  const sure = f?.latest.sure ?? 0;
  const say = !a || !f ? null
    : a === "all" ? {
      title: "Correct the contacts now?",
      text: `The contacts that differ from their company get the company's owner and region responsibility - up to ${full(f.cap)} now, the biggest companies first. Only those two fields are written; A+P people and companies with no owner are left alone. Every change is logged.`,
      go: "Correct now",
    } : a === "latest" ? {
      title: `Correct the ${many(sure, "sure one", "sure ones")}?`,
      text: "These new contacts get their company's owner and region responsibility - their company already has the ones the rules give it. The not sure ones are left alone. Every change is logged.",
      go: `Correct ${full(sure)}`,
    } : {
      title: "Switch Automatic on?",
      text: `Every 15 minutes the hub gives contacts their company's owner and region responsibility: new contacts as they come, the rest up to ${full(f.cap)} at a time. Nothing else is touched; every change is logged.`,
      go: "Switch on",
    };
  return (
    <Dialog open={!!say} onClose={() => !busy && onCancel()} maxWidth="xs" fullWidth>
      {say && a && (
        <>
          <DialogTitle sx={{ fontWeight: 700 }}>{say.title}</DialogTitle>
          <DialogContent><Typography sx={{ fontSize: "0.9rem", color: INK }}>{say.text}</Typography></DialogContent>
          <DialogActions>
            <Button onClick={onCancel} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
            <Button variant="contained" disableElevation disabled={busy} onClick={() => onGo(a)} sx={{ textTransform: "none" }}>
              {busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : say.go}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

/* ── the view ── */

export function ContactsView({ d, names, palette, held, onRetry, onRefresh }: {
  d: MapData; names: Names; palette: Palette;
  /** the page's load (its tab shows the share); without it the view loads its own */
  held?: Held<ContactsData>; onRetry?: () => void;
  /** read the contacts again (only them) - while a pass is going */
  onRefresh?: () => void;
}) {
  const [n, setN] = useState(0);
  const ownUrl = held ? null : `${API}?contacts=1${n ? `&n=${n}` : ""}`;
  const own = useHeld<ContactsData>(ownUrl, [ownUrl]);
  const h = held ?? own;
  const [folded, setFolded] = useState(true);
  const r = h.result;
  const data = contactsOf(h);
  const retry = onRetry ?? (() => setN((x) => x + 1));

  // contacts follow their company: admins correct now, switch Automatic, correct the sure ones (each asked first)
  const follow = data?.follow ?? null;
  const [askFor, setAskFor] = useState<FollowAct | null>(null);
  const [busy, setBusy] = useState<FollowAct | null>(null);
  const [msg, setMsg] = useState<Acts["msg"]>(null);
  const go = async (a: FollowAct) => {
    setBusy(a); setMsg(null);
    const res = a === "auto-on" || a === "auto-off"
      ? await send("PUT", { contactFollow: { auto: a === "auto-on" } })
      : await send("POST", { action: "contacts-follow", scope: a });
    setBusy(null); setAskFor(null);
    if (res.ok && (a === "all" || a === "latest")) setWatchUntil(Date.now() + 90_000);
    const at = a === "latest" ? "latest" : "card";
    const got = (res.data ?? {}) as { started?: boolean; why?: string };
    const text = !res.ok ? `Not done: ${res.error ?? "failed"}`
      : a === "auto-on" ? "Automatic is on - from the next run, every 15 minutes."
      : a === "auto-off" ? "Automatic is off - nothing is corrected by itself any more."
      : got.started === false ? `Not started: ${got.why ?? "a pass is going already"}.`
      : a === "all" ? "Started - the contacts are corrected in the background, the biggest companies first. The count below moves by itself."
      : "Started - the sure ones get their company's owner and region in the background. The count moves by itself.";
    setMsg({ at, ok: res.ok && got.started !== false, text });
    retry();
  };
  const acts: Acts = { admin: d.admin, busy, msg, ask: (a) => (a === "auto-off" ? void go(a) : setAskFor(a)) };
  // while a pass is going (and for a while after one was started - it may start on the other copy of the hub): read the
  // card again every 8 seconds, so its count moves by itself
  const [watchUntil, setWatchUntil] = useState(0);
  const refresh = onRefresh ?? retry;
  const watching = !!follow?.running || Date.now() < watchUntil;
  useEffect(() => {
    if (!watching || h.stale) return;
    const t = window.setTimeout(refresh, 8000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, h.stale, h.result]);

  let top: React.ReactNode;
  if (r === null) top = <LoadingPanel label="Counting the contacts…" />;
  else if (!data) {
    top = r.state === "ok"
      ? <Info>The contact numbers are not there yet - this view fills in once the hub is deployed.</Info>
      : <UpstreamPanel source="Contacts" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={retry} />;
  } else {
    top = (
      <>
        {follow && <FollowCard f={follow} acts={acts} />}
        <NewContactsCard k={data.newContacts} names={names} palette={palette} stale={h.stale}
          sure={follow ? { latest: follow.latest, running: follow.running, acts } : undefined} />
        <MatchCard m={data.match} names={names} palette={palette} />
      </>
    );
  }
  return (
    <>
      <FollowAsk a={askFor} f={follow} busy={busy !== null} onCancel={() => setAskFor(null)} onGo={(a) => void go(a)} />
      {top}
      <GlassCard sx={{ p: 0 }}>
        <Box component="button" type="button" onClick={() => setFolded((x) => !x)} aria-expanded={!folded} sx={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.5, width: "100%", minWidth: 0,
          px: { xs: 2, md: 2.5 }, py: 1.75, borderRadius: "22px", "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:focus-visible": { outline: `2px solid ${ACCENT}` },
        }}>
          <CompareArrowsOutlinedIcon sx={{ fontSize: 20, color: MUTED }} />
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
            <Box component="span" sx={{ display: "block", fontSize: "0.98rem", fontWeight: 600, color: INK }}>Differences by topic</Box>
            <Box component="span" sx={{ display: "block", fontSize: "0.8rem", color: MUTED }}>Companies whose owner, region or contacts differ from the rules, grouped by why - with an OK per topic</Box>
          </Box>
          {folded ? <ExpandMoreIcon sx={{ fontSize: 22, color: MUTED }} /> : <ExpandLessIcon sx={{ fontSize: 22, color: MUTED }} />}
        </Box>
      </GlassCard>
      {!folded && <DiffView d={d} names={names} palette={palette} />}
    </>
  );
}
