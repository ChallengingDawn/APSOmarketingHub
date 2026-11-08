"use client";

// APSOconvert > CREATE AN OPTIMIZATION - the way Webyn starts one (SARCLA 08.11.2026, with Webyn's "Create an
// optimization" on screen: "the A/B testing to A/B testing on the platform, but we should be able to create it from
// here"): 1 the kind - an A/B test (the visitors split between the page as it is and the version, the add-to-carts
// decide) or a live change (the version on for everyone, untested - it lands in Always on); 2 which approved version;
// 3 where it runs - ACC first or production, which of the page's languages, the split. It makes a DRAFT: nothing
// reaches the shop until a person starts it on the test's page (or switches the live change on).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { ACCENT, CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice, clip } from "@/app/uc/report/ui";
import { ago } from "@/app/connectors/parts";
import { ENVS, KIND_LABEL, type Env } from "@/lib/convert/model";
import { ANY_AUDIENCE } from "@/lib/convert/contract";
import { Chip } from "../../Tag";
import { PageShot } from "../../PageShot";
import { SquareChoice } from "../../SquareChoice";
import { convertPost } from "../../Flow";
import { PagePicker, splitOf, type CandidateView, type SplitKey } from "../../TestParts";

type Kind = "test" | "live";
const TESTS_API = "/api/website/ab-testing/pages";
const LIVE_API = "/api/website/ai-personalization/personalise";

function KindCard({ on, icon, title, line, onClick }: { on: boolean; icon: React.ReactNode; title: string; line: string; onClick: () => void }) {
  return (
    <Box component="button" type="button" onClick={onClick} aria-pressed={on} sx={{
      all: "unset", cursor: "pointer", position: "relative", display: "grid", gap: 0.75, p: 2, borderRadius: "14px", minWidth: 0,
      border: `2px solid ${on ? ACCENT : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.05)" : "rgba(255,255,255,.75)", transition: "border-color .12s",
      "&:hover": { borderColor: on ? ACCENT : "rgba(36,89,209,.45)" },
    }}>
      {on && <Box sx={{ position: "absolute", top: 10, right: 10 }}><Chip tint="blue">Selected</Chip></Box>}
      <Box sx={{ width: 34, height: 34, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: "rgba(36,89,209,.1)", color: ACCENT }}>{icon}</Box>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: ACCENT }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.4 }}>{line}</Typography>
    </Box>
  );
}

export default function CreateOptimization() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("test");
  const [sel, setSel] = useState<string | null>(null);
  const [env, setEnv] = useState<Env>("acc");
  const [pages, setPages] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitKey>("half");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const held = useHeld<{ candidates: CandidateView[] }>(TESTS_API, []);
  const r = held.result;
  const cands = useMemo(() => (r?.state === "ok" ? r.data.candidates : []), [r]);
  const c = cands.find((x) => x.versionId === sel) ?? null;

  const pick = (x: CandidateView) => { setSel(x.versionId); setName(x.title); setPages([]); setEnv(x.env); setErr(null); };
  const create = async () => {
    if (!c) return;
    setBusy(true); setErr(null);
    const res = kind === "test"
      ? await convertPost<{ id: string }>(TESTS_API, { action: "create", versionId: c.versionId, env, pages, name, allocation: splitOf(split, 10), audience: ANY_AUDIENCE })
      : await convertPost<{ id: string }>(LIVE_API, { action: "create", versionId: c.versionId, env, pages, name: `${name} - live`, audience: ANY_AUDIENCE });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.push(kind === "test" ? `/website/ai-personalization/tests/${res.data.id}` : "/website/ai-personalization/personalise");
  };

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the approved versions…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Tests" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? (r.status ?? null) : null} onRetry={() => undefined} />;
  else {
    body = (
      <>
        <GlassCard>
          <CardTitle icon={<ScienceOutlinedIcon />} tint="blue" title="1 · Optimization type" note="Test a version against the page as it is, or put it on directly" />
          <Box sx={{ display: "grid", gap: 1.5, mt: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" } }}>
            <KindCard on={kind === "test"} icon={<ScienceOutlinedIcon />} title="A/B test" line="The visitors split between the page as it is and the version; the add-to-carts decide which is better." onClick={() => setKind("test")} />
            <KindCard on={kind === "live"} icon={<BoltOutlinedIcon />} title="Live change" line="The version on for every visitor without a test - it is kept in Always on and can be switched off at once." onClick={() => setKind("live")} />
          </Box>
        </GlassCard>

        <GlassCard>
          <CardTitle icon={<ScienceOutlinedIcon />} tint="purple" title="2 · Which version?" note="The versions approved in the Preview that have no test yet" />
          {cands.length === 0 && (
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 1.25 }}>
              No approved version waits - approve an optimization in <Box component={Link} href="/website/ai-personalization/insights" sx={{ color: ACCENT, fontWeight: 600 }}>Insights</Box>, then its version in the Preview.
            </Typography>
          )}
          <Box sx={{ display: "grid", gap: 1.25, mt: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {cands.map((x) => {
              const on = x.versionId === sel;
              return (
                <Box key={x.versionId} component="button" type="button" onClick={() => pick(x)} aria-pressed={on} sx={{
                  all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", borderRadius: "12px", overflow: "hidden", minWidth: 0,
                  border: `2px solid ${on ? ACCENT : HAIRLINE}`, bgcolor: "#fff",
                }}>
                  <PageShot env={x.env} path={x.path} ratio={0.45} />
                  <Box sx={{ p: 1.25, display: "grid", gap: 0.5 }}>
                    <Box sx={{ display: "flex", gap: 0.5 }}><Chip tint={x.env === "prod" ? "green" : "amber"}>{ENVS[x.env].label}</Chip><Chip tint="slate">{KIND_LABEL[x.kind]}</Chip><Chip tint="blue">rev {x.rev}</Chip></Box>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{x.title}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(9999) }} title={x.path}>{x.path}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>approved{x.approvedBy ? ` by ${x.approvedBy}` : ""}{x.approvedAt ? ` · ${ago(Date.parse(x.approvedAt) / 1000)}` : ""}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </GlassCard>

        {c && (
          <GlassCard>
            <CardTitle icon={<ScienceOutlinedIcon />} tint="green" title="3 · Where should it run?" note="ACC first is the safe start; the page's other languages can take part" />
            <Box sx={{ display: "grid", gap: 1.5, mt: 1.5 }}>
              <SquareChoice<Env> label="Where" value={env} onChange={(e) => { setEnv(e); setPages([]); }} options={[{ key: "acc", label: "ACC first" }, { key: "prod", label: "Production" }]} />
              <PagePicker api={TESTS_API} versionId={c.versionId} env={env} value={pages} onChange={setPages} />
              {kind === "test" && <SquareChoice<SplitKey> label="Split" value={split} onChange={setSplit} options={[{ key: "half", label: "Half and half" }, { key: "30", label: "30% get the version" }, { key: "bandit", label: "The bandit learns" }]} />}
              <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ maxWidth: 620 }} />
              {err && <Notice tone="bad">{err}</Notice>}
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Button variant="contained" disableElevation disabled={busy || !name.trim()} onClick={() => void create()} startIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>
                  {kind === "test" ? "Make the test" : "Make the live change"}
                </Button>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>A draft: nothing reaches the shop until a person {kind === "test" ? "starts the test" : "switches it on"}.</Typography>
              </Box>
            </Box>
          </GlassCard>
        )}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Create an optimization" subtitle="An A/B test or a live change, from an approved version - it also shows in A/B testing" />
      {body}
    </Box>
  );
}
