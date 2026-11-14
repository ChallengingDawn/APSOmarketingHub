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
import PageHeader from "./PageHeader";

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
            sx={{ bgcolor: "#ed1b2f", "&:hover": { bgcolor: "#c41527" }, boxShadow: "none" }}>
            Open Prices · Trends · Stock
          </Button>
        }
      />

      {loading && <LinearProgress sx={{ mb: 2, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}

      {/* KPI cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 2 }}>
        {[
          { icon: <InventoryIcon />, label: "APSO Products", value: fmt(kpis?.products?.unique_articles), sub: `${fmt(kpis?.products?.total)} rows · ${fmt(kpis?.products?.materials)} materials`, color: "#274e64", href: "/pricing/products" },
          { icon: <StorefrontIcon />, label: "Competitor Products", value: fmt(kpis?.total_competitor_products), sub: `${kpis?.competitors?.length ?? 0} competitors`, color: "#ed1b2f", href: "/pricing/competitors" },
          { icon: <JoinInnerIcon />, label: "Matches", value: fmt(kpis?.matches?.total), sub: `${fmt(kpis?.matches?.approved)} approved · ${fmt(kpis?.matches?.avg_confidence)}% avg`, color: "#1e7e45", href: "/pricing/matches" },
          { icon: <PendingActionsIcon />, label: "Pending Review", value: fmt(kpis?.pending_count), sub: `${fmt(kpis?.matches?.very_close)} close · ${fmt(kpis?.matches?.partial)} partial`, color: "#c77700", href: "/pricing/matches/pending" },
        ].map((c) => (
          <Card key={c.label} component={Link} href={c.href} sx={{ textDecoration: "none", border: "1px solid #e6e8ec", borderTop: `3px solid ${c.color}`, transition: "all 0.15s", "&:hover": { boxShadow: "0 2px 4px rgba(26,58,76,0.06), 0 8px 24px rgba(26,58,76,0.08)", transform: "translateY(-2px)" } }}>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: `${c.color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</Box>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#5b6470", textTransform: "uppercase" }}>{c.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: "1.8rem", fontWeight: 700, color: "#1a1d21", fontFamily: "var(--font-outfit), sans-serif", lineHeight: 1 }}>{c.value}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "#5b6470", mt: 0.5 }}>{c.sub}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Match quality breakdown */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 2 }}>
        {[
          { label: "Exact Match (100%)", value: fmt(kpis?.matches?.exact), color: "#1e7e45" },
          { label: "Very Close (90-99%)", value: fmt(kpis?.matches?.very_close), color: "#c77700" },
          { label: "Partial (70-89%)", value: fmt(kpis?.matches?.partial), color: "#c5221f" },
        ].map(s => (
          <Card key={s.label} sx={{ border: "1px solid #e6e8ec" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 }, textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 600, color: "#5b6470", textTransform: "uppercase" }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: s.color, mt: 0.5, fontFamily: "var(--font-outfit), sans-serif" }}>{s.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" }, gap: 2 }}>
        {/* Competitor catalogs + freshness */}
        <Card sx={{ border: "1px solid #e6e8ec" }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #e6e8ec", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#1a1d21", fontFamily: "var(--font-outfit), sans-serif" }}>Competitor catalogs & freshness</Typography>
              <Chip icon={<SyncIcon sx={{ fontSize: 14 }} />} label={`Last scrape ${ago(lastScrape)}`} size="small" sx={{ bgcolor: "#eef2f5", color: freshColor(lastScrape), fontWeight: 600 }} />
            </Box>
            <Box>
              {competitors.length === 0 && <Box sx={{ py: 4, textAlign: "center", color: "#9aa1ab", fontSize: "0.8rem" }}>No competitors yet.</Box>}
              {competitors.map((c, i) => (
                <Box key={c.id} component={Link} href={`/pricing/competitors/${c.code}`}
                  sx={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.3, borderBottom: i < competitors.length - 1 ? "1px solid #f0f1f3" : "none", "&:hover": { bgcolor: "#f7f8fa" } }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: freshColor(c.last_scraped), flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#1a1d21", flex: 1 }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#274e64", fontFamily: "monospace" }}>{fmt(c.product_count)}</Typography>
                  <Typography sx={{ fontSize: "0.68rem", color: "#9aa1ab", minWidth: 64, textAlign: "right" }}>{ago(c.last_scraped)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card sx={{ border: "1px solid #e6e8ec" }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #e6e8ec", display: "flex", alignItems: "center", gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18, color: "#274e64" }} />
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#1a1d21", fontFamily: "var(--font-outfit), sans-serif" }}>Recent activity</Typography>
            </Box>
            <Box sx={{ maxHeight: 360, overflow: "auto" }}>
              {activity.length === 0 && <Box sx={{ py: 4, textAlign: "center", color: "#9aa1ab", fontSize: "0.8rem" }}>No recent activity.</Box>}
              {activity.map((a) => (
                <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, py: 1.1, borderBottom: "1px solid #f5f6f8" }}>
                  <Chip label={a.action} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: a.action === "approved" ? "#e8f5ee" : a.action === "rejected" ? "#fdecea" : "#eef2f5", color: a.action === "approved" ? "#1e7e45" : a.action === "rejected" ? "#c5221f" : "#274e64" }} />
                  <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: "#274e64", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.apso_article_number || "—"}{a.competitor_code ? ` ↔ ${a.competitor_code}` : ""}</Typography>
                  <Typography sx={{ fontSize: "0.62rem", color: "#9aa1ab", whiteSpace: "nowrap" }}>{ago(a.created_at)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
