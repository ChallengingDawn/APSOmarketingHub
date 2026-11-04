"use client";
// BESPOKE CHECKS, BESIDE THE ACTION PLAN (SARCLA 04.11.2026: "if we bring the list as a sub app via the header we could
// update automatically, ready to export"; "we need tracking per Bespoke request"): Bespoke's technical SEO/GEO check of
// apsoparts.com, one row per check. Each open check is a sub-action of "Bespoke technical plan - implementation" with its
// own ticket; the row reads that sub-action as the plan has it - Live or Maintaining makes the check OK, Killed makes it
// N/A - and the export writes Bespoke's own columns back. Bespoke's "validated" and "feedback" are typed here when they
// answer. Admins only, as the plan (../layout.tsx). Data and set-up: src/lib/reporting/bespoke.ts.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, hsTicket } from "@/app/uc/report/ui";
import type { BespokeView, CheckRow } from "@/lib/reporting/bespoke";
import { EXPORT_COLUMNS, STAGE_LABEL, dmy, exportRow } from "@/lib/reporting/bespokeRules";
import { xlsxBlob } from "@/lib/xlsxBrowser";
import { stageColor } from "../planUi";

type Show = "open" | "ok" | "na" | "late" | "all";
const AMBER = { fg: "#a15c07", bg: "#fff3dc" };
const SPEEDS = ["Fast", "Needs a push", "Slow"] as const;
const SPEED_TONE: Record<string, { fg: string; bg: string }> = {
  Fast: { fg: GREEN, bg: "#dcf1e7" }, "Needs a push": AMBER, Slow: { fg: RED, bg: "#fde7e7" },
  Done: { fg: GREEN, bg: "#dcf1e7" }, Killed: { fg: MUTED, bg: "#eef1f6" },
};
const STATE_TONE = { open: AMBER, ok: { fg: GREEN, bg: "#dcf1e7" }, na: { fg: MUTED, bg: "#eef1f6" } } as const;
const STATE_LABEL = { open: "Open", ok: "OK", na: "N/A" } as const;
const WIDTHS: Record<string, number> = { A: 6, B: 18, C: 14, D: 10, E: 50, F: 9, G: 11, H: 70, I: 10, J: 10, K: 60, L: 12, M: 12, N: 40 };

const chip = (on: boolean, fg: string = TINT.blue.fg, bg: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.8rem",
  fontWeight: on ? 800 : 600, px: 1.1, py: 0.45, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const, display: "inline-flex", alignItems: "center", gap: 0.6,
});
/** A square tag, as the plan has them. */
function Tag({ children, fg, bg, title }: { children: React.ReactNode; fg: string; bg: string; title?: string }) {
  return (
    <Box component="span" title={title} sx={{ display: "inline-block", px: 0.75, py: "1px", borderRadius: "3px", bgcolor: bg, color: fg, fontSize: "0.72rem", fontWeight: 750, whiteSpace: "nowrap", lineHeight: 1.5 }}>
      {children}
    </Box>
  );
}
const clamp = (lines: number) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" as const, overflow: "hidden" });
const th = { textAlign: "left" as const, fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.05em", px: 1, py: 0.9, whiteSpace: "nowrap" as const, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "#f8f9fb", position: "sticky" as const, top: 0, zIndex: 1 };
const td = { px: 1, py: 1, verticalAlign: "top", borderTop: `1px solid ${HAIRLINE}`, fontSize: "0.82rem", color: INK };

/** Bespoke's own text, as they wrote it (line breaks kept). */
function Para({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 750, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: INK, whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 0.25 }}>{text}</Typography>
    </Box>
  );
}

function Detail({ r, onFeedback }: { r: CheckRow; onFeedback: (text: string) => void }) {
  const [fb, setFb] = useState(r.typed.feedback ?? r.feedback);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.3fr) minmax(0,1fr)" }, gap: 2, p: 1.5, bgcolor: "#fbfcfd" }}>
      <Box sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
        <Para label="Bespoke's observation" text={r.observation || "None written on this row of Bespoke's sheet."} />
        <Para label="Our comment in the sheet" text={r.next} />
      </Box>
      <Box sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
        {r.sub && <Para label="Status note (from the sub-action)" text={r.sub.statusNote} />}
        {r.sub?.work && <Para label="Who does it" text={r.sub.work} />}
        {r.sub?.basis && <Para label="Planned date based on" text={r.sub.basis} />}
        <TextField label="Bespoke's feedback" size="small" multiline minRows={2} value={fb} onChange={(e) => setFb(e.target.value)}
          onBlur={() => { if (fb !== (r.typed.feedback ?? r.feedback)) onFeedback(fb); }}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#fff", fontSize: "0.84rem" } }} />
      </Box>
    </Box>
  );
}

export default function BespokeChecksPage() {
  const [data, setData] = useState<BespokeView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState<Show>("open");
  const [tier1, setTier1] = useState(false);
  const [speed, setSpeed] = useState<string | null>(null);
  const [who, setWho] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [opened, setOpened] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/action-plan/bespoke");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      setData(j as BespokeView); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // while the plan is being set up, the page follows it
  const running = !!data?.setup.running;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [running, load]);

  const rows = useMemo(() => data?.checks ?? [], [data]);
  const people = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.sub && r.state === "open") m.set(r.sub.ownerName || "Nobody", (m.get(r.sub.ownerName || "Nobody") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const count = (s: Show) => rows.filter((r) => (s === "all" ? true : s === "late" ? r.late : r.state === s)).length;
  const words = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => (show === "all" ? true : show === "late" ? r.late : r.state === show))
    .filter((r) => !tier1 || r.tier === "TIER 1")
    .filter((r) => !speed || r.sub?.speed === speed)
    .filter((r) => !who.length || who.includes(r.sub?.ownerName || "Nobody"))
    .filter((r) => !words || `#${r.id} ${r.topic} ${r.page} ${r.desc} ${r.found} ${r.ask} ${r.sub?.title ?? ""}`.toLowerCase().includes(words))
    .sort((a, b) => {
      const ord = { open: 0, ok: 1, na: 2 } as const;
      if (a.state !== b.state) return ord[a.state] - ord[b.state];
      if (a.state === "open") return (a.sub?.start ?? "9999").localeCompare(b.sub?.start ?? "9999") || (a.rank ?? 99) - (b.rank ?? 99) || a.id - b.id;
      return a.id - b.id;
    });

  const patch = async (id: number, body: { validation?: string; feedback?: string }) => {
    setData((d) => d && { ...d, checks: d.checks.map((c) => (c.id === id ? { ...c, typed: { ...c.typed, ...body } } : c)) });
    try {
      const r = await fetch("/api/action-plan/bespoke", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...body }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
    } catch (e) { setErr(`Not saved: ${(e as Error).message}`); void load(); }
  };
  const makeMissing = async () => {
    try {
      const r = await fetch("/api/action-plan/bespoke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setup" }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      setData((d) => d && { ...d, setup: { ...d.setup, running: true } });
    } catch (e) { setErr((e as Error).message); }
  };
  const exportXlsx = async () => {
    if (!data) return;
    const day = dmy(data.today);
    const blob = await xlsxBlob([{
      name: "SEO Technical Check",
      preamble: [data.website, `APSO's answers of ${day}: status, who, problem solved, next steps and resolution date from the Action plan.`],
      columns: EXPORT_COLUMNS.map((k) => ({ header: data.columns[k] ?? k, width: WIDTHS[k] })),
      rows: [...data.checks].sort((a, b) => a.id - b.id).map((c) => exportRow(c, c.sub, c.typed)),
    }]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `[APSOparts] SEO_GEO Technical Check - APSO answers ${day}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const tile = (label: string, n: number, s: Show, color = INK) => (
    <Box component="button" type="button" onClick={() => setShow(s)} aria-pressed={show === s}
      sx={{ all: "unset", cursor: "pointer", display: "grid", gap: 0.25, px: 1.75, py: 1.25, borderRadius: "10px", bgcolor: show === s ? TINT.blue.bg : "#fff", border: `1px solid ${show === s ? TINT.blue.fg : HAIRLINE}`, minWidth: 110 }}>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</Typography>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 650, color: MUTED }}>{label}</Typography>
    </Box>
  );
  const setup = data?.setup;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      <HomeBar on="Bespoke checks" plan />

      <GlassCard sx={{ display: "grid", gap: 1.75 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>Bespoke checks</Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.35rem", md: "1.55rem" }, fontWeight: 650, letterSpacing: "-0.02em", color: INK, mt: 0.5, textWrap: "balance" }}>
              Bespoke&apos;s technical SEO/GEO check - each request a sub-action, its status from the plan
            </Typography>
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.75, maxWidth: 980 }}>
              The 137 checks of apsoparts.com Bespoke made in June 2026. Each open one is a sub-action of{" "}
              {data?.actionId ? <Link href={`/action-plan?item=${data.actionId}`} style={{ color: TINT.blue.fg, fontWeight: 650 }}>Bespoke technical plan - implementation</Link> : "Bespoke technical plan - implementation"}{" "}
              with its own ticket. Live or Maintaining makes the check OK, Killed makes it N/A. The export writes Bespoke&apos;s own columns back.
            </Typography>
          </Box>
          <Button variant="contained" disableElevation startIcon={<FileDownloadOutlinedIcon />} onClick={() => void exportXlsx()} disabled={!data}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: "8px" }}>
            Export for Bespoke (.xlsx)
          </Button>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {tile("Open", count("open"), "open", AMBER.fg)}
          {tile("OK", count("ok"), "ok", GREEN)}
          {tile("N/A", count("na"), "na", MUTED)}
          {tile("Late", count("late"), "late", RED)}
        </Box>
        {setup && setup.missing > 0 && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", p: 1.25, borderRadius: "8px", bgcolor: AMBER.bg, border: `1px solid ${AMBER.fg}33` }}>
            {setup.running && <CircularProgress size={16} sx={{ color: AMBER.fg }} />}
            <Typography sx={{ flex: 1, minWidth: 240, fontSize: "0.86rem", color: INK }}>
              {setup.running
                ? `Setting up the plan: the two actions, the sub-actions and their tickets - ${setup.missing} of ${setup.total} still to make. This page follows it.`
                : `${setup.missing} of ${setup.total} not made yet.`}
            </Typography>
            {!setup.running && (
              <Button variant="contained" disableElevation onClick={() => void makeMissing()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>
                Make the missing sub-actions
              </Button>
            )}
            {!setup.running && setup.errors.length > 0 && (
              <Box sx={{ flexBasis: "100%", display: "grid", gap: 0.25 }}>
                {setup.errors.slice(0, 8).map((e) => <Typography key={e} sx={{ fontSize: "0.78rem", color: RED, overflowWrap: "anywhere" }}>{e}</Typography>)}
              </Box>
            )}
          </Box>
        )}
        {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      </GlassCard>

      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        <TextField size="small" placeholder="Search - check number, topic, words" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 280, "& .MuiInputBase-root": { bgcolor: "#fff", fontSize: "0.86rem" } }} />
        <Box component="button" type="button" aria-pressed={show === "all"} onClick={() => setShow("all")} sx={chip(show === "all")}>All {rows.length}</Box>
        <Box component="button" type="button" aria-pressed={tier1} onClick={() => setTier1((v) => !v)} sx={chip(tier1, RED, "#fde7e7")}>Tier 1</Box>
        <Box sx={{ width: 8 }} />
        {SPEEDS.map((s) => (
          <Box key={s} component="button" type="button" aria-pressed={speed === s} onClick={() => setSpeed((v) => (v === s ? null : s))} sx={chip(speed === s, SPEED_TONE[s].fg, SPEED_TONE[s].bg)}>{s}</Box>
        ))}
        <Box sx={{ width: 8 }} />
        {people.map(([name, n]) => {
          const on = who.includes(name);
          return <Box key={name} component="button" type="button" aria-pressed={on} title={`${n} open`} onClick={() => setWho((w) => (on ? w.filter((x) => x !== name) : [...w, name]))} sx={chip(on)}>{name} · {n}</Box>;
        })}
        {(tier1 || speed || who.length > 0 || q) && <Button size="small" onClick={() => { setTier1(false); setSpeed(null); setWho([]); setQ(""); }} sx={{ textTransform: "none", fontWeight: 650 }}>Clear</Button>}
      </Box>

      {!data && !err && <Box sx={{ display: "flex", gap: 1, alignItems: "center", p: 2 }}><CircularProgress size={18} /><Typography sx={{ color: MUTED, fontSize: "0.9rem" }}>Reading the checks and the plan…</Typography></Box>}
      {data && (
        <GlassCard sx={{ p: 0, overflow: "hidden" }}>
          <Box sx={{ overflowX: "auto", maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
            <Box component="table" sx={{ width: "100%", minWidth: 1280, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Bespoke's check", "What Bespoke asks", "Tier", "Status", "Sub-action", "Who", "Planned", "Go-live", "Can we go fast?", "Bespoke validated"].map((h) => (
                    <Box component="th" key={h} sx={th}>{h}</Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const open = opened === r.id;
                  const st = r.sub?.stage ? stageColor(r.sub.stage) : null;
                  const sp = r.sub ? SPEED_TONE[r.sub.speed] : null;
                  return (
                    <Fragment key={r.id}>
                      <Box component="tr" sx={{ bgcolor: open ? "#f4f7fd" : r.state === "open" ? "#fff" : "#fbfbfc" }}>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap", fontWeight: 750 }}>
                          <IconButton size="small" aria-label={open ? "Close the check" : "Open the check"} aria-expanded={open} onClick={() => setOpened(open ? null : r.id)} sx={{ ml: -0.75, mr: 0.25, transform: open ? "rotate(180deg)" : "none" }}>
                            <ExpandMoreIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          #{r.id}
                        </Box>
                        <Box component="td" sx={{ ...td, width: "17%" }}>
                          <Typography sx={{ fontSize: "0.72rem", color: FAINT, fontWeight: 650 }}>{[r.topic, r.page].filter(Boolean).join(" · ")}</Typography>
                          <Typography title={r.desc} sx={{ fontSize: "0.82rem", color: INK, ...clamp(open ? 20 : 3) }}>{r.desc}</Typography>
                        </Box>
                        <Box component="td" sx={{ ...td, width: "27%" }}>
                          {r.found || r.ask ? (
                            <>
                              {r.found && <Typography sx={{ fontSize: "0.8rem", color: MUTED, ...clamp(open ? 20 : 2) }}>{r.found}</Typography>}
                              {r.ask && <Typography sx={{ fontSize: "0.82rem", color: INK, mt: 0.25, ...clamp(open ? 20 : 4) }}><b>Asks:</b> {r.ask}</Typography>}
                            </>
                          ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{r.status === "N/A" ? "Not applicable in Bespoke's check." : "Passed in Bespoke's check."}</Typography>}
                        </Box>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: r.tier === "TIER 1" ? RED : INK }}>{r.tier ? r.tier.replace("TIER ", "Tier ") : "-"}</Typography>
                          {r.difficulty && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{r.difficulty}</Typography>}
                        </Box>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                          <Box sx={{ display: "grid", gap: 0.4, justifyItems: "start" }}>
                            <Tag fg={STATE_TONE[r.state].fg} bg={STATE_TONE[r.state].bg} title={`Bespoke's sheet: ${r.status}`}>{STATE_LABEL[r.state]}</Tag>
                            {r.sub?.stage && st && <Tag fg={st.ink} bg={st.soft}>{STAGE_LABEL[r.sub.stage] ?? ""}</Tag>}
                            {r.late && <Tag fg="#fff" bg={RED}>LATE</Tag>}
                          </Box>
                        </Box>
                        <Box component="td" sx={{ ...td, width: "15%" }}>
                          {r.sub ? (
                            <Box sx={{ display: "flex", gap: 0.25, alignItems: "flex-start" }}>
                              <Box component={Link} href={`/action-plan?sub=${r.sub.taskId}`} sx={{ flex: 1, minWidth: 0, color: TINT.blue.fg, fontWeight: 650, fontSize: "0.82rem", textDecoration: "none", "&:hover": { textDecoration: "underline" }, ...clamp(3) }}>
                                {r.sub.title}
                              </Box>
                              {r.sub.ticketId && (
                                <IconButton size="small" component="a" href={hsTicket(r.sub.ticketId)} target="_blank" rel="noreferrer" aria-label="Open the ticket in HubSpot" title={`Ticket ${r.sub.ticketId}`} sx={{ mt: -0.5 }}>
                                  <OpenInNewIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              )}
                            </Box>
                          ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{r.state === "open" ? (setup?.running ? "Being made…" : "None yet") : "-"}</Typography>}
                        </Box>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>{r.sub?.ownerName.split(" ")[0] ?? (r.who || "-")}</Box>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: r.late ? RED : INK, fontWeight: r.late ? 750 : 400 }}>{dmy(r.sub?.start) || "-"}</Box>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{dmy(r.sub?.due) || "-"}</Box>
                        <Box component="td" sx={{ ...td, width: "20%" }}>
                          {r.sub && sp ? (
                            <Typography title={r.sub.why} sx={{ fontSize: "0.8rem", color: MUTED, ...clamp(open ? 20 : 3) }}>
                              <Tag fg={sp.fg} bg={sp.bg}>{r.sub.speed}</Tag>{" "}{r.sub.why}
                            </Typography>
                          ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>-</Typography>}
                        </Box>
                        <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                          <Box component="select" aria-label={`Bespoke validated check ${r.id}`} value={r.typed.validation ?? (r.validation === "1" ? "Yes" : "")}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => void patch(r.id, { validation: e.target.value })}
                            sx={{ font: "inherit", fontSize: "0.8rem", px: 0.5, py: 0.25, borderRadius: "4px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", color: INK }}>
                            <option value="">Not yet</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </Box>
                        </Box>
                      </Box>
                      {open && (
                        <tr>
                          <Box component="td" colSpan={11} sx={{ p: 0, borderTop: `1px solid ${HAIRLINE}` }}>
                            <Detail r={r} onFeedback={(text) => void patch(r.id, { feedback: text })} />
                          </Box>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!shown.length && (
                  <tr><Box component="td" colSpan={11} sx={{ ...td, color: FAINT, textAlign: "center", py: 3 }}>No check here.</Box></tr>
                )}
              </tbody>
            </Box>
          </Box>
        </GlassCard>
      )}
    </Box>
  );
}
