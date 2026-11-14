"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import InventoryIcon from "@mui/icons-material/Inventory";
import StorefrontIcon from "@mui/icons-material/Storefront";
import JoinInnerIcon from "@mui/icons-material/JoinInner";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import InsightsIcon from "@mui/icons-material/Insights";
import SyncIcon from "@mui/icons-material/Sync";
import HistoryIcon from "@mui/icons-material/History";
import PageHeader from "../PageHeader";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import RuleIcon from "@mui/icons-material/Rule";
import { KpiTile } from "@/app/uc/report/ui";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

interface KPIs {
  products: { total: string; unique_articles: string; m100: string; m110: string; materials: string; profit_centers: string };
  competitors: { id: number; code: string; name: string; market: string; business_unit: string; product_count: string }[];
  total_competitor_products: number;
  matches: { total: string; approved: string; pending: string; exact: string; very_close: string; partial: string; avg_confidence: number | null };
  pending_count: number;
  log_entries: number;
  cross_references: number;
}
interface CompetitorInfo { id: number; code: string; name: string; product_count: string; last_scraped: string | null }
interface ActivityRow { id: number; action: string; apso_article_number: string | null; competitor_code: string | null; user_email: string | null; created_at: string }

function fmt(n: number | string | null | undefined) {
  if (n == null) return "—";
  const v = typeof n === "string" ? parseFloat(n) : n;
  return isNaN(v) ? "—" : v.toLocaleString();
}
function ago(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function freshColor(iso: string | null): string {
  if (!iso) return "#aeb4bd";
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days <= 7) return "#1e7e45";
  if (days <= 30) return "#c77700";
  return "#c5221f";
}

export default function MissionControlPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorInfo[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [k, c, a] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/kpis`).then(r => r.json()),
        fetch(`${API_URL}/api/competitors`).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/api/dashboard/recent-activity`).then(r => r.json()).catch(() => []),
      ]);
      setKpis(k);
      setCompetitors(Array.isArray(c) ? c : []);
      setActivity(Array.isArray(a) ? a : []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const lastScrape = competitors
    .map(c => c.last_scraped)
    .filter(Boolean)
    .sort()
    .pop() || null;

  return (
    <Box>
      <PageHeader
        icon="dashboard"
        eyebrow="Pricing"
        title="Overview"
        subtitle="Operational status — catalog freshness, scraping & matching. Pricing analytics live in Prices · Trends · Stock."
        rightSlot={
          <Button component={Link} href="/pricing/prices" variant="contained" startIcon={<InsightsIcon />}
            sx={{ bgcolor: "#2459d1", "&:hover": { bgcolor: "#1d4ab3" } }}>
            Open Prices · Trends · Stock
          </Button>
        }
      />

      {loading && <LinearProgress sx={{ mb: 2, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}

      {/* The headline figures, as every hub report draws them (src/app/uc/report/ui.tsx KpiTile); each opens its page */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 2 }}>
        {([
          { icon: <InventoryIcon />, tint: "blue", label: "APSO products", value: fmt(kpis?.products?.unique_articles), note: `${fmt(kpis?.products?.total)} rows · ${fmt(kpis?.products?.materials)} materials`, href: "/pricing/products" },
          { icon: <StorefrontIcon />, tint: "pink", label: "Competitor products", value: fmt(kpis?.total_competitor_products), note: `${kpis?.competitors?.length ?? 0} competitors`, href: "/pricing/competitors" },
          { icon: <JoinInnerIcon />, tint: "green", label: "Matches", value: fmt(kpis?.matches?.total), note: `${fmt(kpis?.matches?.approved)} approved · ${fmt(kpis?.matches?.avg_confidence)}% average confidence`, href: "/pricing/matches" },
          { icon: <PendingActionsIcon />, tint: "amber", label: "Pending review", value: fmt(kpis?.pending_count), note: `${fmt(kpis?.matches?.very_close)} very close · ${fmt(kpis?.matches?.partial)} partial`, href: "/pricing/matches/pending" },
        ] as const).map((c) => (
          <Box key={c.label} component={Link} href={c.href} sx={{
            textDecoration: "none", borderRadius: "20px", display: "block",
            "& > div": { transition: "box-shadow .2s ease" },
            "&:hover > div": { boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 18px 40px rgba(31,45,78,.11)" },
          }}>
            <KpiTile icon={c.icon} tint={c.tint} label={c.label} value={c.value} note={c.note} />
          </Box>
        ))}
      </Box>

      {/* How close the matches are */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 2 }}>
        {([
          { icon: <VerifiedOutlinedIcon />, tint: "green", label: "Exact match (100 %)", value: fmt(kpis?.matches?.exact) },
          { icon: <TrackChangesIcon />, tint: "amber", label: "Very close (90-99 %)", value: fmt(kpis?.matches?.very_close) },
          { icon: <RuleIcon />, tint: "pink", label: "Partial (70-89 %)", value: fmt(kpis?.matches?.partial) },
        ] as const).map((s) => <KpiTile key={s.label} icon={s.icon} tint={s.tint} label={s.label} value={s.value} />)}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" }, gap: 2 }}>
        {/* Competitor catalogs + freshness */}
        <Card sx={{ border: "1px solid #e4e9f1" }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #e4e9f1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#15223a", fontFamily: "var(--font-outfit), sans-serif" }}>Competitor catalogs & freshness</Typography>
              <Chip icon={<SyncIcon sx={{ fontSize: 14 }} />} label={`Last scrape ${ago(lastScrape)}`} size="small" sx={{ bgcolor: "#eef2f5", color: freshColor(lastScrape), fontWeight: 600 }} />
            </Box>
            <Box>
              {competitors.length === 0 && <Box sx={{ py: 4, textAlign: "center", color: "#8b97ac", fontSize: "0.8rem" }}>No competitors yet.</Box>}
              {competitors.map((c, i) => (
                <Box key={c.id} component={Link} href={`/pricing/competitors/${c.code}`}
                  sx={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.3, borderBottom: i < competitors.length - 1 ? "1px solid #f0f1f3" : "none", "&:hover": { bgcolor: "#f7f8fa" } }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: freshColor(c.last_scraped), flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#15223a", flex: 1 }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#274e64", fontFamily: "monospace" }}>{fmt(c.product_count)}</Typography>
                  <Typography sx={{ fontSize: "0.68rem", color: "#8b97ac", minWidth: 64, textAlign: "right" }}>{ago(c.last_scraped)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card sx={{ border: "1px solid #e4e9f1" }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #e4e9f1", display: "flex", alignItems: "center", gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18, color: "#274e64" }} />
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#15223a", fontFamily: "var(--font-outfit), sans-serif" }}>Recent activity</Typography>
            </Box>
            <Box sx={{ maxHeight: 360, overflow: "auto" }}>
              {activity.length === 0 && <Box sx={{ py: 4, textAlign: "center", color: "#8b97ac", fontSize: "0.8rem" }}>No recent activity.</Box>}
              {activity.map((a) => (
                <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, py: 1.1, borderBottom: "1px solid #f5f7fb" }}>
                  <Chip label={a.action} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: a.action === "approved" ? "#e8f5ee" : a.action === "rejected" ? "#fdecea" : "#eef2f5", color: a.action === "approved" ? "#1e7e45" : a.action === "rejected" ? "#c5221f" : "#274e64" }} />
                  <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: "#274e64", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.apso_article_number || "—"}{a.competitor_code ? ` ↔ ${a.competitor_code}` : ""}</Typography>
                  <Typography sx={{ fontSize: "0.62rem", color: "#8b97ac", whiteSpace: "nowrap" }}>{ago(a.created_at)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
