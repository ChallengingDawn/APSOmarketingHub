"use client";

// APSOconvert > Journeys > Visits - the small parts the list, the customer and the player share: times in Swiss time,
// the squared tags (how far a visit got, what an article did), a visit's strip of pages, how each source answered.

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { FAINT, INK, MUTED } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { KIND_COLOR, KIND_NAME, type JKind } from "@/lib/journeys/model";
import { REACH_LABEL, REACH_TINT, lookReach, lookWords, type Look, type Reach } from "@/lib/convert/visitRules";
import type { VisitSources } from "@/lib/convert/visits";

export const VISITS = "/website/ai-personalization/journeys/visits";
const TZ = "Europe/Zurich";

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const ddmm = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { timeZone: TZ, day: "2-digit", month: "2-digit" });
export const ddmmyyyy = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
export const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short" });
const zDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });

/** "10:21", "yesterday 10:21", "Sat 08.11 10:21" */
export function when(iso: string | null): string {
  if (!iso) return "-";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "-";
  const today = zDay(Date.now()), d = zDay(t);
  if (d === today) return `today ${hhmm(iso)}`;
  if (d === zDay(Date.now() - 86_400_000)) return `yesterday ${hhmm(iso)}`;
  return `${weekday(iso)} ${ddmm(iso)} ${hhmm(iso)}`;
}

export const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;

export function ReachTag({ reach }: { reach: Reach }) {
  return <Chip tint={REACH_TINT[reach]}>{REACH_LABEL[reach]}</Chip>;
}

/** What one article did, as a squared tag: below the minimum and no stock in pink - the shop stopped them there. */
export function LookTag({ look }: { look: Look }) {
  const r = lookReach(look);
  const tint = r === "order" ? "green" : r === "cart" ? "amber" : look.step === "moq" || look.step === "shelf" ? "pink" : r === "price" ? "purple" : "slate";
  return <Chip tint={tint}>{lookWords(look)}</Chip>;
}

/** A kind of page as a small coloured square and its name. */
export function KindTag({ kind }: { kind: JKind }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.72rem", fontWeight: 700, color: MUTED, whiteSpace: "nowrap" }}>
      <Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: KIND_COLOR[kind], flex: "none" }} />
      {KIND_NAME[kind]}
    </Box>
  );
}

/** A visit's pages as a row of small squares in their kind's colour - the order they were opened in. */
export function MiniStrip({ kinds, size = 10, max = 16 }: { kinds: JKind[]; size?: number; max?: number }) {
  if (!kinds.length) return null;
  return (
    <Box aria-label={kinds.map((k) => KIND_NAME[k]).join(", ")} sx={{ display: "flex", gap: "3px", flexWrap: "nowrap", alignItems: "center", minWidth: 0, overflow: "hidden" }}>
      {kinds.slice(0, max).map((k, i) => <Box key={i} sx={{ width: size, height: size, borderRadius: "2px", bgcolor: KIND_COLOR[k], flex: "none" }} />)}
      {kinds.length > max && <Typography component="span" sx={{ fontSize: "0.68rem", color: FAINT, ml: 0.25 }}>+{kinds.length - max}</Typography>}
    </Box>
  );
}

/** The kinds of page shown, for reading the colours. */
export function KindLegend({ kinds }: { kinds: JKind[] }) {
  const shown = [...new Set(kinds)];
  return <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>{shown.map((k) => <KindTag key={k} kind={k} />)}</Box>;
}

/** How each source answered, as squared tags - green when it gave all it can, amber when only part, slate when absent. */
export function SourceTags({ sources }: { sources: VisitSources }) {
  const one = (label: string, s: VisitSources["shop"], partialLabel?: string) => {
    const tint = s.state === "ok" ? "green" : s.state === "partial" ? "amber" : s.state === "off" ? "slate" : "pink";
    const text = s.state === "ok" ? label : s.state === "partial" ? (partialLabel ?? `${label}: in part`) : s.state === "off" ? `${label}: not connected` : `${label}: not read`;
    return (
      <Tooltip key={label} title={s.note ?? ""} disableHoverListener={!s.note}>
        <span><Chip tint={tint}>{s.state === "ok" && <CheckRoundedIcon sx={{ fontSize: 13, mr: 0.4 }} />}{text}</Chip></span>
      </Tooltip>
    );
  };
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
      {one("The shop's record", sources.shop)}
      {sources.hubspot.state !== "ok" ? one("HubSpot", sources.hubspot) : one("HubSpot pages", sources.pages, "HubSpot: last page per person")}
    </Box>
  );
}

/** A small label above a group of lines. */
export function Kick({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: ".06em", mb: 0.75 }}>{children}</Typography>;
}

export const mono = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
export const strong = { fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.3 } as const;
