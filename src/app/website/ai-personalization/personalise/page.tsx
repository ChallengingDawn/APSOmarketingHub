"use client";

// APSOconvert > PERSONALISE (Website > AI testing & personalization). An audience always gets a version: signed-in
// customers of de-CH on a phone, visitors from an ad, everyone... - no split, still counted (src/lib/convert/tests.ts,
// kind "personalisation"; the shop's gateway runs it). Made from an approved version and an audience; switching one on
// is the approval that puts it on the shop, and its confirm says what goes live where.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonPinCircleOutlinedIcon from "@mui/icons-material/PersonPinCircleOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice, clip } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { ENVS, KIND_LABEL, type Env } from "@/lib/convert/model";
import { ANY_AUDIENCE, audienceWords, type Audience } from "@/lib/convert/contract";
import { convertPost, previewHref } from "../Flow";
import { SquareChoice } from "../SquareChoice";
import { PageShot } from "../PageShot";
import {
  AudienceBuilder, ConfirmDialog, GatewayNotice, PagePicker, StatusChip, dayTime, envChip, n, pagesLine, pct,
  type CandidateView, type Confirm, type GatewayView, type TestView,
} from "../TestParts";

const API = "/api/website/ai-personalization/personalise";
type Data = { items: TestView[]; candidates: CandidateView[]; stores: string[]; gateway: GatewayView; canEdit: boolean };
type Show = "on" | "off" | "all";
const since = (iso: string | null) => (iso ? ago(Date.parse(iso) / 1000) : "–");
const LABEL = { fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" as const, letterSpacing: ".04em" };

function Maker({ d, onMade, ask }: { d: Data; onMade: () => void; ask: (c: Confirm) => void }) {
  const [versionId, setVersionId] = useState<string>("");
  const [env, setEnv] = useState<Env>("acc");
  const [pages, setPages] = useState<string[]>([]);
  const [aud, setAud] = useState<Audience>({ ...ANY_AUDIENCE, login: "customer" });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = d.candidates.find((c) => c.versionId === versionId) ?? null;
  useEffect(() => { if (v) { setName(v.title); setPages([]); } }, [v?.versionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async (on: boolean): Promise<boolean> => {
    if (!v) return false;
    setBusy(true); setErr(null);
    const r = await convertPost<{ id: string }>(API, { action: "create", versionId: v.versionId, env, pages, audience: aud, name });
    if (!r.ok) { setBusy(false); setErr(r.error); return true; }
    if (on) {
      const s = await convertPost(API, { action: "on", id: r.data.id });
      if (!s.ok) setErr(`Saved as a draft, not switched on: ${s.error}`);
    }
    setBusy(false);
    setVersionId("");
    onMade();
    return true;
  };
  const host = env === "prod" ? "www.apsoparts.com" : "acc.apsoparts.com";
  return (
    <GlassCard>
      <CardTitle icon={<AddCircleOutlineIcon />} tint="purple" title="A new personalisation" note="An approved version, for an audience - everyone in it gets the version" />
      {d.candidates.length === 0 ? (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
          No version sent to a project yet - send one from the <Box component={Link} href="/website/ai-personalization/preview" sx={{ color: ACCENT, fontWeight: 600 }}>Preview</Box> first.
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Box sx={{ display: "grid", gap: 0.5 }}>
            <Typography sx={LABEL}>The version</Typography>
            <Box sx={{ display: "grid", gap: 0.5, maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
              {d.candidates.map((c) => {
                const on = c.versionId === versionId;
                return (
                  <Box key={c.versionId} component="button" type="button" onClick={() => setVersionId(on ? "" : c.versionId)} aria-pressed={on} sx={{
                    all: "unset", cursor: "pointer", display: "grid", gap: 0.25, px: 1.25, py: 0.9, borderRadius: "6px", minWidth: 0,
                    border: `1px solid ${on ? "#2459d1" : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.65)",
                    "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
                  }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: on ? "#2459d1" : INK, ...clip(1000) }}>{c.title}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(1000) }}>{KIND_LABEL[c.kind]} · {c.path} · rev {c.rev}{c.approvedBy ? ` · approved by ${c.approvedBy}` : ""}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
          {v && (
            <>
              <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 200 }} />
              <SquareChoice<Env> label="Where" value={env} onChange={(e) => { setEnv(e); setPages([]); }} options={[{ key: "acc", label: "ACC first" }, { key: "prod", label: "Production" }]} />
              <PagePicker api={API} versionId={v.versionId} env={env} value={pages} onChange={setPages} />
              <Box sx={{ display: "grid", gap: 0.75 }}>
                <Typography sx={LABEL}>Who gets it</Typography>
                <AudienceBuilder value={aud} onChange={setAud} stores={d.stores} />
                <Typography sx={{ fontSize: "0.8rem", color: INK }}>Who gets it: <b>{audienceWords(aud)}</b>, with statistics consent. Everyone else sees the page as it is.</Typography>
              </Box>
              {err && <Notice tone="bad">{err}</Notice>}
              {d.canEdit && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button size="small" disabled={busy || !name.trim()} onClick={() => void make(false)}>Save as a draft</Button>
                  <Button size="small" variant="contained" disableElevation disabled={busy || !name.trim() || !d.gateway.configured}
                    startIcon={busy ? <CircularProgress size={13} color="inherit" /> : undefined}
                    onClick={() => ask({
                      title: `Switch it on, on ${ENVS[env].label}?`,
                      lines: [<>The version (rev {v.rev}) goes live for <b>{audienceWords(aud).toLowerCase() === "everyone" ? "everyone" : audienceWords(aud)}</b> on {host}:</>, pagesLine(host, pages.length ? pages : [v.path]), "Switching it on is the approval: the shop's gateway runs it within a minute. Switch it off any time."],
                      go: "Switch it on", run: () => make(true),
                    })}>Save and switch on</Button>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </GlassCard>
  );
}

function Item({ t, canEdit, ask, run }: { t: TestView; canEdit: boolean; ask: (c: Confirm) => void; run: (body: Record<string, unknown>) => Promise<boolean> }) {
  const f = t.figures?.counted ? t.figures : null;
  const err = t.figures?.error ?? null;
  const on = t.status === "running";
  const ended = t.status === "stopped" || t.status === "shipped";
  const toggle = () => ask(on
    ? { title: "Switch it off?", lines: ["Everyone sees the page as it is until it is switched on again. The figures stay."], go: "Switch off", tone: "stop", run: () => run({ action: "off", id: t.id }) }
    : { title: `Switch it on, on ${ENVS[t.env].label}?`, lines: [<>The version (rev {t.versionRev}) goes live for <b>{audienceWords(t.audience)}</b> on {t.host}:</>, pagesLine(t.host, t.pages), "Switching it on is the approval: the shop's gateway runs it within a minute."], go: "Switch on", run: () => run({ action: "on", id: t.id }) });
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "150px minmax(0,1fr) auto auto" }, gap: { xs: 1, md: 2 }, alignItems: "center", py: 1.25, borderBottom: `1px solid ${HAIRLINE}` }}>
      {t.pages[0]
        ? <Box component={Link} href={previewHref(t.env, t.pages[0], t.ideaId ?? undefined)} sx={{ display: { xs: "none", md: "block" }, borderRadius: "8px", overflow: "hidden", border: `1px solid ${HAIRLINE}` }}><PageShot env={t.env} path={t.pages[0]} /></Box>
        : <Box sx={{ display: { xs: "none", md: "block" } }} />}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
          <StatusChip status={t.status} kind={t.kind} />
          {envChip(t.env)}
          {t.fromTest && <Chip tint="purple">Winner of test #{t.fromTest}</Chip>}
          {t.drift && <Chip tint="pink">{t.drift === "missing" ? "Not on the gateway" : "Gateway behind"}</Chip>}
        </Box>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mt: 0.5, ...clip(900) }} title={t.name}>{t.name}</Typography>
        <Typography sx={{ fontSize: "0.8rem", color: INK }}><b>{audienceWords(t.audience)}</b> <Box component="span" sx={{ color: MUTED }}>→ the version, rev {t.versionRev}</Box></Typography>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(900) }} title={t.pages.join("\n")}>
          <Box component={Link} href={previewHref(t.env, t.pages[0], t.ideaId ?? undefined)} sx={{ color: ACCENT, textDecoration: "none" }}>{t.pages[0]}</Box>{t.pages.length > 1 ? ` +${t.pages.length - 1}` : ""}
          {" · "}{t.startedAt ? `on since ${dayTime(t.startedAt)}${t.startedBy ? ` (${t.startedBy})` : ""}` : `made ${since(t.createdAt)} by ${t.createdBy ?? "–"}`}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: { xs: 2.5, md: 2 }, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        {[
          ["Visitors", f ? n(f.b.visitors) : "–"],
          ["To cart", f ? n(f.b.carts) : "–"],
          ["Cart rate", f ? pct(f.b.rate, 1) : "–"],
        ].map(([k, val]) => (
          <Box key={k}><Typography sx={{ fontSize: "0.68rem", color: MUTED, fontWeight: 700, textTransform: "uppercase" }}>{k}</Typography><Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{val}</Typography></Box>
        ))}
        {err && <Typography sx={{ fontSize: "0.72rem", color: MUTED, alignSelf: "center" }} title={err}>{f?.at ? `as of ${since(f.at)}` : "not read"}</Typography>}
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap" }}>
        {canEdit && t.status === "draft" && <Button size="small" color="error" onClick={() => ask({ title: "Delete this draft?", lines: ["It was never switched on - nothing on the shop changes."], go: "Delete", tone: "stop", run: () => run({ action: "delete", id: t.id }) })}>Delete</Button>}
        {canEdit && (t.status === "running" || t.status === "paused") && <Button size="small" onClick={() => ask({ title: "End it?", lines: ["Everyone sees the page as it is. The figures stay; switching it on again starts a new count."], go: "End it", tone: "stop", run: () => run({ action: "end", id: t.id }) })}>End</Button>}
        {canEdit && (
          <Tooltip title={on ? "On - switch off" : ended ? "Ended - switch on again (counted from zero)" : "Off - switch on"}>
            <Switch checked={on} onChange={toggle} slotProps={{ input: { "aria-label": on ? "Switch off" : "Switch on" } }} />
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function Personalise() {
  const [tick, setTick] = useState(0);
  const [show, setShow] = useState<Show>("all");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const url = `${API}?n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const rows = useMemo(() => {
    const all = r?.state === "ok" ? r.data.items : [];
    return {
      all, on: all.filter((t) => t.status === "running"), off: all.filter((t) => t.status !== "running"),
      shown: all.filter((t) => show === "all" || (show === "on" ? t.status === "running" : t.status !== "running")),
    };
  }, [r, show]);
  const run = async (body: Record<string, unknown>): Promise<boolean> => {
    setErr(null);
    const res = await convertPost(API, body);
    if (!res.ok) setErr(res.error);
    setTick((x) => x + 1);
    return true;
  };

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the personalisations…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Personalise" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => setTick((x) => x + 1)} />;
  else {
    const d = r.data;
    body = (
      <>
        <GatewayNotice g={d.gateway} what="personalisations" />
        {err && <Notice tone="bad">{err}</Notice>}
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.5fr) minmax(0,1fr)" }, alignItems: "start" }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.75 } }}>
            <CardTitle icon={<PersonPinCircleOutlinedIcon />} tint="green" title={`Personalisations · ${n(rows.all.length)}`}
              note={`${rows.on.length} on now. Counted like a test: the visitors in the audience who saw it, and their add-to-carts`} />
            <SquareChoice<Show> label="Show" value={show} onChange={setShow} options={[{ key: "all", label: "All", count: rows.all.length }, { key: "on", label: "On", count: rows.on.length }, { key: "off", label: "Off or not started", count: rows.off.length }]} />
            <Box sx={{ mt: 1 }}>
              {rows.shown.length === 0 && (
                <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>
                  {rows.all.length ? "None here." : "No personalisation yet. Make one beside this list - or put a test's winner on for everyone from Winners."}
                </Typography>
              )}
              {rows.shown.map((t) => <Item key={t.id} t={t} canEdit={d.canEdit} ask={setConfirm} run={run} />)}
            </Box>
          </GlassCard>
          <Maker d={d} onMade={() => setTick((x) => x + 1)} ask={setConfirm} />
        </Box>
        <ConfirmDialog c={confirm} onClose={() => setConfirm(null)} />
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Personalise"
        subtitle="An audience always gets a version: signed-in customers, a store view, phones, visitors from an ad"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again"><IconButton size="small" onClick={() => setTick((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
          </Box>
        }
      />
      {body}
    </Box>
  );
}
