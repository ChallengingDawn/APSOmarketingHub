"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import ArticleIcon from "@mui/icons-material/Article";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PublishIcon from "@mui/icons-material/Publish";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import InsightsIcon from "@mui/icons-material/Insights";
import CableIcon from "@mui/icons-material/Cable";
import Link from "next/link";

/* ── types ── */

type LibItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Trend = { term: string; signal: string };

const CH_COLORS: Record<string, string> = {
  linkedin: "#0077b5",
  newsletter: "#274e64",
  blog: "#ed1b2f",
  ad: "#9334e6",
  product: "#34a853",
  seo: "#fbbc04",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#fff4e0", fg: "#c77700" },
  approved: { bg: "#e5f3ea", fg: "#1e7e45" },
  published: { bg: "#e3edf7", fg: "#2563a8" },
  archived: { bg: "#f0f1f3", fg: "#5b6470" },
};

const QG_CHANNELS = ["linkedin", "blog", "newsletter", "ad", "seo", "product"];

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/* ── page ── */

export default function MissionControl() {
  const [items, setItems] = useState<LibItem[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [contentGap, setContentGap] = useState<string>("");
  const [greeting, setGreeting] = useState("Welcome back");
  const [today, setToday] = useState("");

  const loadItems = useCallback(() => {
    fetch("/api/content?limit=100")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadItems();
    fetch("/api/personality")
      .then((r) => r.json())
      .then((brain) => {
        setTrends(brain?.keywordSignals?.internalSearchTrends?.slice(0, 4) ?? []);
        setContentGap(brain?.categoryIntelligence?.contentGap ?? "");
      })
      .catch(() => {});
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setToday(
      new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    );
  }, [loadItems]);

  const drafts = useMemo(() => items.filter((i) => i.status === "draft"), [items]);
  const counts = useMemo(
    () => ({
      total: items.filter((i) => i.status !== "archived").length,
      drafts: drafts.length,
      approved: items.filter((i) => i.status === "approved").length,
      published: items.filter((i) => i.status === "published").length,
    }),
    [items, drafts]
  );
  const pipeline = useMemo(
    () => [
      { status: "Draft", count: counts.drafts, color: "#f59e0b" },
      { status: "Approved", count: counts.approved, color: "#10b981" },
      { status: "Published", count: counts.published, color: "#3b82f6" },
    ],
    [counts]
  );
  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0);

  /* Quick Generate — generation on main */
  const [qgChannel, setQgChannel] = useState("linkedin");
  const [qgTopic, setQgTopic] = useState("");
  const [qgBusy, setQgBusy] = useState(false);
  const [qgResult, setQgResult] = useState<{ content?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const quickGenerate = async () => {
    if (!qgTopic.trim() || qgBusy) return;
    setQgBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: qgChannel, prompt: qgTopic.trim(), wantBrief: false }),
      });
      const data = await res.json();
      setQgResult(res.ok ? { content: data.content } : { error: data.error ?? "Generation failed" });
      loadItems();
    } catch {
      setQgResult({ error: "Network error — try again" });
    } finally {
      setQgBusy(false);
    }
  };

  const generateFromSignal = (term: string) => {
    setQgChannel("blog");
    setQgTopic(
      `In-depth technical guide targeting the search term "${term}" — what buyers searching this need to know`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyResult = async () => {
    if (qgResult?.content) {
      await navigator.clipboard.writeText(qgResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const kpis = [
    { label: "In Library", value: counts.total, period: "active items", icon: <ArticleIcon />, color: "#274e64", bg: "#e8f0f4", href: "/library" },
    { label: "Drafts Pending", value: counts.drafts, period: "awaiting review", icon: <PendingActionsIcon />, color: "#ed1b2f", bg: "#fdebed", href: "/library" },
    { label: "Approved", value: counts.approved, period: "ready to publish", icon: <CheckCircleIcon />, color: "#1e7e45", bg: "#e5f3ea", href: "/library" },
    { label: "Published", value: counts.published, period: "live content", icon: <PublishIcon />, color: "#2563a8", bg: "#e3edf7", href: "/library" },
  ];

  return (
    <Box>
      {/* ── Hero: greeting + Quick Generate ── */}
      <Card
        sx={{
          mb: 2.5,
          background: "linear-gradient(120deg, #16303f 0%, #274e64 55%, #35657f 100%)",
          color: "#fff",
          border: "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            right: -60,
            top: -60,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(237,27,47,0.35) 0%, rgba(237,27,47,0) 70%)",
          }}
        />
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, position: "relative" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: { xs: 24, md: 30 }, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                {greeting}.
              </Typography>
              <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.75)", mt: 0.5 }} suppressHydrationWarning>
                {today} · {counts.drafts > 0 ? `${counts.drafts} draft${counts.drafts === 1 ? "" : "s"} waiting for your review` : "pipeline is clear"}
              </Typography>
            </Box>
            <Chip
              icon={<AutoAwesomeIcon sx={{ color: "#fff !important", fontSize: 16 }} />}
              label="Claude Opus 5 engine"
              sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 600, fontSize: 12 }}
            />
          </Box>

          {/* Quick Generate bar */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              gap: 1.25,
              alignItems: "center",
              flexWrap: { xs: "wrap", md: "nowrap" },
              bgcolor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 2,
              p: 1.25,
              backdropFilter: "blur(6px)",
            }}
          >
            <TextField
              select
              size="small"
              value={qgChannel}
              onChange={(e) => setQgChannel(e.target.value)}
              sx={{
                minWidth: 140,
                "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 1.5 },
              }}
            >
              {QG_CHANNELS.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              placeholder='What should we create? e.g. "FFKM o-rings for chemical processing — when FKM is not enough"'
              value={qgTopic}
              onChange={(e) => setQgTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") quickGenerate();
              }}
              sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 1.5 } }}
            />
            <Button
              onClick={quickGenerate}
              disabled={qgBusy || !qgTopic.trim()}
              variant="contained"
              startIcon={qgBusy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon />}
              sx={{
                bgcolor: "#ed1b2f",
                whiteSpace: "nowrap",
                px: 3,
                "&:hover": { bgcolor: "#d81528" },
                "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.6)" },
              }}
            >
              {qgBusy ? "Writing…" : "Generate"}
            </Button>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", mt: 1, ml: 0.5 }}>
            Full control — personas, keywords, images — in{" "}
            <Link href="/content-generation" style={{ color: "#fff", fontWeight: 600 }}>
              Content Generation
            </Link>
            . Every result is saved to the Library as a draft.
          </Typography>
        </CardContent>
      </Card>

      {/* ── KPI row (all live) ── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {kpis.map((k) => (
          <Grid key={k.label} size={{ xs: 6, lg: 3 }}>
            <Card
              component={Link}
              href={k.href}
              className="hover-lift"
              sx={{ display: "block", textDecoration: "none", borderTop: `3px solid ${k.color}`, height: "100%" }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", "& svg": { fontSize: 19 } }}>
                    {k.icon}
                  </Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {k.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 30, fontWeight: 700, color: "#1a1d21", mt: 1, lineHeight: 1 }}>
                  {k.value}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#5b6470", mt: 0.5 }}>{k.period}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Integrations strip ── */}
      <Card sx={{ mb: 2.5, bgcolor: "#fbfbfc" }}>
        <CardContent sx={{ py: 1.5, px: 2.5, "&:last-child": { pb: 1.5 }, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <CableIcon sx={{ fontSize: 18, color: "#5b6470" }} />
          <Typography sx={{ fontSize: 13, color: "#3c4043", flex: 1, minWidth: 240 }}>
            <strong>Traffic & ranking metrics are one connection away</strong> — GA4, Search Console and HubSpot integrations are prepared and waiting for credentials.
          </Typography>
          {["GA4", "Search Console", "HubSpot"].map((n) => (
            <Chip key={n} label={n} size="small" sx={{ fontWeight: 600, bgcolor: "#f0f1f3", color: "#5b6470" }} />
          ))}
        </CardContent>
      </Card>

      {/* ── Approval queue + Demand signals ── */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#fbbc04" }} />
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Approval Queue</Typography>
                </Box>
                <Chip label={`${counts.drafts} pending`} size="small" sx={{ fontWeight: 700, bgcolor: "#fef7e0", color: "#b06000" }} />
              </Box>
              {drafts.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 4 }}>
                  Queue is clear — generate something above.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {drafts.slice(0, 5).map((d) => (
                    <Box
                      key={d.id}
                      sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: 1.5, border: "1px solid #f1f3f4", "&:hover": { bgcolor: "#fafbfc" } }}
                    >
                      <Box sx={{ width: 3, height: 30, borderRadius: 2, bgcolor: CH_COLORS[d.channel] ?? "#5b6470", flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: "#1a1d21" }}>
                          {d.title || d.body.slice(0, 90)}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "#5b6470" }}>
                          <Box component="span" sx={{ color: CH_COLORS[d.channel], fontWeight: 700, textTransform: "uppercase" }}>{d.channel}</Box>
                          {" · "}{timeAgo(d.createdAt)}
                        </Typography>
                      </Box>
                      <Button component={Link} href="/library" size="small" variant="contained" sx={{ bgcolor: "#1e7e45", fontSize: 11.5, px: 1.5, py: 0.4, "&:hover": { bgcolor: "#17643a" } }}>
                        Review
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
              <Box sx={{ mt: 1.5, textAlign: "center" }}>
                <Button component={Link} href="/library" endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />} sx={{ fontSize: 12.5, fontWeight: 600, color: "#274e64" }}>
                  Open the Content Library
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#ed1b2f" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Demand Signals</Typography>
                <Chip label="from real shop search data" size="small" sx={{ fontWeight: 600, fontSize: 10.5, bgcolor: "#e5f3ea", color: "#1e7e45" }} />
              </Box>
              <Typography sx={{ fontSize: 12.5, color: "#5b6470", ml: 1.75, mb: 1.5 }}>
                What APSOparts customers are actually searching — turn a signal into content in one click.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {trends.map((t) => (
                  <Box key={t.term} sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: 1.5, border: "1px solid #f1f3f4" }}>
                    <TrendingUpIcon sx={{ fontSize: 18, color: "#ed1b2f", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#1a1d21" }}>{t.term}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>{t.signal}</Typography>
                    </Box>
                    <Tooltip title="Prefill the generator with this signal">
                      <Button size="small" onClick={() => generateFromSignal(t.term)} startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />} sx={{ fontSize: 11.5, fontWeight: 700, color: "#ed1b2f", whiteSpace: "nowrap" }}>
                        Generate
                      </Button>
                    </Tooltip>
                  </Box>
                ))}
                {trends.length === 0 && (
                  <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 3 }}>
                    Loading signals…
                  </Typography>
                )}
              </Box>
              {contentGap && (
                <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: "#fdf6ec", border: "1px solid #f5e3c4", display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <InsightsIcon sx={{ fontSize: 17, color: "#c77700", mt: 0.2 }} />
                  <Typography sx={{ fontSize: 12, color: "#7a5200", lineHeight: 1.5 }}>{contentGap}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Pipeline + Recent activity ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#34a853" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Content Pipeline</Typography>
                <Chip label={`${pipelineTotal} items`} size="small" sx={{ fontWeight: 700, bgcolor: "#f0f1f3", color: "#3c4043" }} />
              </Box>
              {pipeline.map((stage) => (
                <Box key={stage.status} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                  <Typography sx={{ width: 84, fontSize: 12.5, fontWeight: 600, color: "#3c4043" }}>{stage.status}</Typography>
                  <Box sx={{ flex: 1, height: 22, bgcolor: "#f0f1f3", borderRadius: 1, overflow: "hidden" }}>
                    <Box
                      sx={{
                        width: pipelineTotal ? `${Math.max(6, (stage.count / pipelineTotal) * 100)}%` : "0%",
                        height: "100%",
                        bgcolor: stage.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        pr: 1,
                        transition: "width 0.6s ease",
                      }}
                    >
                      {stage.count > 0 && (
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#fff" }}>{stage.count}</Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              ))}
              {pipelineTotal === 0 && (
                <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 2 }}>
                  Pipeline is empty — everything starts with a generation.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a1d21" }}>Recent Activity</Typography>
              </Box>
              {items.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: "#5b6470", textAlign: "center", py: 4 }}>
                  No activity yet.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {items.slice(0, 6).map((i) => {
                    const sc = STATUS_COLORS[i.status] ?? STATUS_COLORS.archived;
                    return (
                      <Box key={i.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.75, borderBottom: "1px solid #f5f6f8", "&:last-child": { borderBottom: "none" } }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CH_COLORS[i.channel] ?? "#5b6470", flexShrink: 0 }} />
                        <Typography noWrap sx={{ flex: 1, fontSize: 13, color: "#1a1d21", minWidth: 0 }}>
                          {i.title || i.body.slice(0, 80)}
                        </Typography>
                        <Chip label={i.status} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: sc.bg, color: sc.fg }} />
                        <Typography sx={{ fontSize: 11.5, color: "#5b6470", whiteSpace: "nowrap" }}>{timeAgo(i.updatedAt)}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Quick Generate result ── */}
      <Dialog open={Boolean(qgResult)} onClose={() => setQgResult(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {qgResult?.error ? "Generation failed" : "Draft created and saved to the Library"}
        </DialogTitle>
        <DialogContent dividers>
          {qgResult?.error ? (
            <Typography sx={{ fontSize: 14, color: "#c5221f" }}>{qgResult.error}</Typography>
          ) : (
            <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.65 }}>
              {qgResult?.content}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          {!qgResult?.error && (
            <>
              <Button startIcon={<ContentCopyIcon />} onClick={copyResult}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button component={Link} href="/library" variant="contained" sx={{ bgcolor: "#274e64" }}>
                Open in Library
              </Button>
            </>
          )}
          <Button onClick={() => setQgResult(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
