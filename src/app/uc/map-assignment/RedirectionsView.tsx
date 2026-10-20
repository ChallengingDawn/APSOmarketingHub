"use client";

// MAP ASSIGNMENT - Redirections: Owner redirection, inside Map assignment since 19.10.2026 (SARCLA: "Owner redirection
// is now a part of Map assignment, so it should be taken out as a sub-app"). The board is Owner redirection's own
// (src/app/uc/owner-redirection/OwnerRedirection.tsx) with its own data and API; only the place moved.
// Above it, the rules that work against the map (SARCLA 20.10.2026: "if these rules are contrary to assignment we need
// to have an alert here that we accept or decline"), per rule: accept = the map wins, the rule is switched off and
// published; decline = the rule wins, the map leaves its companies alone (src/lib/mapAssign/redirections.ts).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import { full } from "@/app/charts/format";
import { OwnerRedirectionView } from "@/app/uc/owner-redirection/OwnerRedirection";
import { AMBER, CardTitle, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice, glass } from "@/app/uc/report/ui";
import { when } from "@/app/connectors/parts";
import type { MapData, RedirectionConflict } from "@/lib/mapAssign/api";
import { API, Swatch, countryName, type Names, type Palette } from "./shared";

type Decision = "map" | "rule" | null;

/** Still to answer: on, against the map, and not kept over it (a "keep" lapses when the rule changes). */
export const isOpenConflict = (c: RedirectionConflict) =>
  c.enabled && c.against.length > 0 && !(c.decision?.current && c.decision.decision === "rule");

/** The rules still to answer - the count on the Redirections tab. */
export function openConflicts(d: MapData): number {
  return (d.conflicts ?? []).filter(isOpenConflict).length;
}

const many = (n: number, one: string, more: string) => `${full(n)} ${n === 1 ? one : more}`;
const places = (ccs: string[]) => `${ccs.slice(0, 3).map(countryName).join(", ")}${ccs.length > 3 ? ` +${ccs.length - 3}` : ""}`;

/** What the rule matches, in words. */
function what(c: RedirectionConflict, names: Names): string {
  if (c.kind === "owner") return `Owned by ${names.name(c.fromOwner)}`;
  const custom = c.customCountries.length ? ` or custom country ${c.customCountries.join(", ")}` : "";
  return `Country is ${c.countries.join(", ") || "—"}${custom}`;
}

/** PUT {redirection}: the route's answer carries a `note` beside the data (published or not) - send() leaves it out. */
async function answer(ruleId: string, decision: Decision): Promise<{ ok: true; note: string | null } | { ok: false; error: string }> {
  try {
    const r = await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirection: { ruleId, decision } }) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; note?: string } | null;
    if (!j) return { ok: false, error: r.status === 403 ? "refused (HTTP 403) - signed out?" : `HTTP ${r.status} - the route did not answer in JSON` };
    if (j.ok === true) return { ok: true, note: typeof j.note === "string" && j.note ? j.note : null };
    return { ok: false, error: j.error ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function Title({ c, names, palette }: { c: RedirectionConflict; names: Names; palette: Palette }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
      <Box component="span">Rule {c.position}: {what(c, names)} →</Box>
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}><Swatch paint={palette(c.toOwner)} />{names.name(c.toOwner)}</Box>
    </Box>
  );
}

function Alert({ c, d, names, palette, busy, onAsk }: {
  c: RedirectionConflict; d: MapData; names: Names; palette: Palette; busy: boolean; onAsk: (decision: "map" | "rule") => void;
}) {
  const off = c.against.reduce((a, x) => a + x.companies, 0);
  const stale = c.decision && (!c.decision.current || c.decision.decision === "map");
  return (
    <Box sx={{ ...glass, borderRadius: "18px", borderLeft: `3px solid ${AMBER}`, p: { xs: 1.75, md: 2 }, minWidth: 0 }}>
      <Typography component="div" sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK }}><Title c={c} names={names} palette={palette} /></Typography>
      <Typography sx={{ fontSize: "0.86rem", color: INK, mt: 0.75 }}>
        The map gives <b>{full(off)}</b> of its {many(c.matched, "company", "companies")} to someone else:
      </Typography>
      <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 0, listStyle: "none", display: "grid", gap: 0.4 }}>
        {c.against.map((x) => (
          <Box component="li" key={String(x.owner)} sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", fontSize: "0.84rem", color: INK }}>
            <Swatch paint={palette(x.owner)} />
            <Box component="span" sx={{ fontWeight: 600 }}>{names.name(x.owner)}</Box>
            {!names.active(x.owner) && <Box component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>has left</Box>}
            <Box component="span" sx={{ color: MUTED }}>{many(x.companies, "company", "companies")}{x.countries.length ? ` · ${places(x.countries)}` : ""}</Box>
          </Box>
        ))}
      </Box>
      {stale && c.decision && (
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.75 }}>
          {c.decision.current
            ? `It was switched off for the map ${when(c.decision.at)} by ${c.decision.by}, and is on again - answer again.`
            : `The rule changed since it was answered ${when(c.decision.at)} - answer again.`}
        </Typography>
      )}
      {d.admin && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
          <Button variant="contained" disableElevation size="small" disabled={busy} onClick={() => onAsk("map")} sx={{ textTransform: "none" }}>Accept the map</Button>
          <Button variant="outlined" size="small" disabled={busy} onClick={() => onAsk("rule")} sx={{ textTransform: "none" }}>Decline - keep the rule</Button>
        </Box>
      )}
    </Box>
  );
}

function Answered({ c, d, names, palette, busy, onChange }: {
  c: RedirectionConflict; d: MapData; names: Names; palette: Palette; busy: boolean; onChange: () => void;
}) {
  const a = c.decision;
  if (!a) return null;
  const how = a.decision === "map" ? "switched off, the map wins" : a.current ? "kept over the map" : "the map agrees with it now";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", py: 0.75, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
      <Typography component="div" sx={{ fontSize: "0.84rem", color: INK, flex: "1 1 280px", minWidth: 0 }}>
        <Title c={c} names={names} palette={palette} />
        <Box component="span" sx={{ color: MUTED }}> - {how} · {when(a.at)} by {a.by}</Box>
      </Typography>
      {d.admin && <Button size="small" disabled={busy} onClick={onChange} sx={{ textTransform: "none", minWidth: 0 }}>Change</Button>}
    </Box>
  );
}

export function RedirectionsView({ d, names, palette, onChanged }: {
  /** null while the map data loads - then only the Owner redirection board */
  d: MapData | null; names: Names; palette: Palette; onChanged: () => void;
}) {
  const [ask, setAsk] = useState<{ c: RedirectionConflict; decision: Decision } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(null);
  // the board reads its own data: a new key after an answer reads it again (an accepted rule shows as off)
  const [board, setBoard] = useState(0);
  const all = d?.conflicts ?? [];
  const open = all.filter(isOpenConflict);
  const answered = all.filter((c) => !isOpenConflict(c) && c.decision);

  const go = async () => {
    if (!ask) return;
    const { c, decision } = ask;
    setBusy(true); setMsg(null);
    const r = await answer(c.ruleId, decision);
    setBusy(false); setAsk(null);
    if (!r.ok) setMsg({ tone: "bad", text: `Rule ${c.position}: ${r.error}` });
    else {
      const fallback = decision === "map" ? `Done - rule ${c.position} is off.` : decision === "rule" ? `Kept - rule ${c.position} wins over the map.` : `Rule ${c.position}: answer forgotten.`;
      const text = r.note ? `Rule ${c.position}: ${r.note}` : fallback;
      setMsg({ tone: /NOT published/i.test(text) ? "warn" : "ok", text });
    }
    setBoard((x) => x + 1);
    onChanged();
  };

  const off = ask ? ask.c.against.reduce((a, x) => a + x.companies, 0) : 0;
  const liveThere = ask && d ? [...new Set(ask.c.against.flatMap((x) => x.countries))].filter((cc) => !!d.live[cc]) : [];
  const n = ask?.c.position ?? 0;
  return (
    <>
      {d && open.length > 0 && (
        <Notice tone="warn">
          {open.length === 1 ? "1 Owner redirection rule works" : `${open.length} Owner redirection rules work`} against the map{d.admin ? " - accept the map or keep the rule" : ""}.
        </Notice>
      )}
      {msg && (msg.tone === "ok"
        ? <Typography sx={{ fontSize: "0.84rem", color: GREEN }}>{msg.text}</Typography>
        : <Notice tone={msg.tone === "bad" ? "bad" : "warn"}>{msg.text}</Notice>)}
      {d && open.map((c) => (
        <Alert key={c.ruleId} c={c} d={d} names={names} palette={palette} busy={busy} onAsk={(decision) => setAsk({ c, decision })} />
      ))}
      {d && answered.length > 0 && (
        <GlassCard sx={{ p: { xs: 1.75, md: 2 } }}>
          <CardTitle icon={<DoneAllOutlinedIcon />} tint="green" title="Answered" note="Rules that went against the map, and what was decided" />
          <Box sx={{ mt: -1 }}>
            {answered.map((c) => (
              <Answered key={c.ruleId} c={c} d={d} names={names} palette={palette} busy={busy} onChange={() => setAsk({ c, decision: null })} />
            ))}
          </Box>
        </GlassCard>
      )}

      <OwnerRedirectionView key={`owner-redirection-${board}`} />

      <Dialog open={!!ask} onClose={() => !busy && setAsk(null)} maxWidth="sm" fullWidth>
        {ask && (
          <>
            <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <AltRouteOutlinedIcon sx={{ color: AMBER }} />
              {ask.decision === "map" ? `Accept the map for rule ${n}?` : ask.decision === "rule" ? `Keep rule ${n} over the map?` : `Answer rule ${n} again?`}
            </DialogTitle>
            <DialogContent sx={{ display: "grid", gap: 1.25 }}>
              <Typography component="div" sx={{ fontSize: "0.86rem", color: MUTED }}><Title c={ask.c} names={names} palette={palette} /></Typography>
              {ask.decision === "map" && (
                <>
                  <Typography sx={{ fontSize: "0.9rem", color: INK }}>
                    Rule {n} is switched off in Owner redirection and published to HubSpot. Its companies then follow the map (once their country is live in Map assignment).
                    {" "}The map gives <b>{full(off)}</b> of its {many(ask.c.matched, "company", "companies")} to someone else.
                  </Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                    {liveThere.length ? `Live already: ${liveThere.map(countryName).join(", ")} - the next scan writes them.` : "None of their countries is live yet - nothing is written until one is."}
                  </Typography>
                </>
              )}
              {ask.decision === "rule" && (
                <Typography sx={{ fontSize: "0.9rem", color: INK }}>
                  The rule keeps its companies: Map assignment gives these {many(ask.c.matched, "company", "companies")} to <b>{names.name(ask.c.toOwner)}</b> and leaves them alone.
                  The map&apos;s zones and SAE do not apply to them.
                </Typography>
              )}
              {ask.decision === null && (
                <Typography sx={{ fontSize: "0.9rem", color: INK }}>
                  {ask.c.decision?.decision === "map"
                    ? <>The answer is forgotten. This does <b>not</b> switch rule {n} back on - that is on the board below.</>
                    : <>The answer is forgotten and the map decides these companies again. If the rule still works against the map, its alert comes back.</>}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAsk(null)} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
              <Button variant="contained" disableElevation color={ask.decision === "map" ? "error" : "primary"} disabled={busy} onClick={() => void go()} sx={{ textTransform: "none" }}>
                {busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : ask.decision === "map" ? `Switch rule ${n} off` : ask.decision === "rule" ? "Keep the rule" : "Forget the answer"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
