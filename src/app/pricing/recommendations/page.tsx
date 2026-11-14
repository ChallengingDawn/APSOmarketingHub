"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PageHeader from "../PageHeader";
import { FilterBar, TextFilter, HierFilter, ClearFilters, type HierOpt } from "../Filters";
import { useSavedFilters } from "@/lib/pricing/prefs";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";

type RecoType = "too_expensive" | "pricing_power" | "stock_gap" | "price_move";
type Severity = "critical" | "warning" | "info" | "positive";
interface Reco { id: string; type: RecoType; severity: Severity; title: string; detail: string; material?: string; competitor?: string; metric?: number }
interface HierFilters { profit_centers: string[]; main_groups: HierOpt[]; sub_groups: HierOpt[]; assortments: HierOpt[]; product_groups: HierOpt[] }

const SEV: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: "#c5221f", bg: "#fdecea", label: "Critical" },
  warning: { color: "#c77700", bg: "#fdf3e2", label: "Warning" },
  info: { color: "#2563a8", bg: "#e8f0fa", label: "Info" },
  positive: { color: "#1e7e45", bg: "#e8f5ee", label: "Opportunity" },
};
const TYPE: Record<RecoType, { label: string; icon: React.ReactElement }> = {
  too_expensive: { label: "Too expensive", icon: <TrendingUpIcon sx={{ fontSize: 18 }} /> },
  pricing_power: { label: "Pricing power", icon: <TrendingDownIcon sx={{ fontSize: 18 }} /> },
  price_move: { label: "Competitor moves", icon: <SwapVertIcon sx={{ fontSize: 18 }} /> },
  stock_gap: { label: "Stock gaps", icon: <Inventory2Icon sx={{ fontSize: 18 }} /> },
};

export default function RecommendationsPage() {
  // Market, signal type and the hierarchy filters are saved per user; they stay until "Clear all".
  const sf = useSavedFilters("alerts", {
    mandant: "M100" as "M100" | "M110", type: "all" as RecoType | "all",
    pc: "", mat: "", ass: "", mg: "", sg: "", pg: "",
  });
  const [mandant, setMandant] = sf.bind("mandant");
  const [filter, setFilter] = sf.bind("type");
  const [recos, setRecos] = useState<Reco[]>([]);
  const [loading, setLoading] = useState(true);
  // Same hierarchy filter bar as every other page (multi-select, comma-joined values).
  const [hier, setHier] = useState<HierFilters | null>(null);
  const [materials, setMaterials] = useState<string[]>([]);
  const [fPC, setFPC] = sf.bind("pc");
  const [fMat, setFMat] = sf.bind("mat");
  const [fAss, setFAss] = sf.bind("ass");
  const [fMG, setFMG] = sf.bind("mg");
  const [fSG, setFSG] = sf.bind("sg");
  const [fPG, setFPG] = sf.bind("pg");

  useEffect(() => {
    fetch(`${API_URL}/api/products/filters`).then(r => r.json()).then(setHier).catch(() => {});
    fetch(`${API_URL}/api/analytics/materials`).then(r => r.json()).then(d => setMaterials(((d.data || []) as { material: string }[]).map(m => m.material))).catch(() => {});
  }, []);

  const fetchRecos = useCallback(async () => {
    if (!sf.ready) return;  // wait for the saved filters so the page loads once
    setLoading(true);
    try {
      const p = new URLSearchParams({ mandant });
      if (fPC) p.set("profit_center", fPC);
      if (fMat) p.set("material", fMat);
      if (fAss) p.set("assortment", fAss);
      if (fMG) p.set("main_group", fMG);
      if (fSG) p.set("sub_group", fSG);
      if (fPG) p.set("product_group", fPG);
      const r = await fetch(`${API_URL}/api/alerts/recommendations?${p}`).then(r => r.json());
      setRecos(r.recommendations || []);
    } catch { setRecos([]); } finally { setLoading(false); }
  }, [mandant, fPC, fMat, fAss, fMG, fSG, fPG, sf.ready]);
  useEffect(() => { fetchRecos(); }, [fetchRecos]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of recos) m[r.type] = (m[r.type] || 0) + 1;
    return m;
  }, [recos]);

  const shown = filter === "all" ? recos : recos.filter(r => r.type === filter);

  return (
    <Box>
      <PageHeader
        icon="alerts"
        eyebrow="Overview"
        title="Recommendations"
        subtitle="Data-driven pricing & stock signals — where to act, and why."
        rightSlot={
          <ToggleButtonGroup exclusive value={mandant} onChange={(_, v) => v && setMandant(v)}
            sx={{ "& .MuiToggleButton-root": { px: 2, py: 0.7, fontSize: "0.8rem", fontWeight: 800, color: "#c5221f", borderColor: "#f3b0b6", "&.Mui-selected": { bgcolor: "#ed1b2f", color: "#fff", "&:hover": { bgcolor: "#c41527" } } } }}>
            <ToggleButton value="M100">M100 · CHF</ToggleButton>
            <ToggleButton value="M110">M110 · EUR</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {/* Standard hierarchy filter bar — identical to the other pages */}
      <FilterBar right={<ClearFilters show={sf.active} onClick={() => sf.reset()} />}>
        <TextFilter label="Profit Center" value={fPC} options={hier?.profit_centers || []} onChange={setFPC} />
        <TextFilter label="Material" value={fMat} options={materials} onChange={setFMat} />
        <HierFilter label="Assortment" value={fAss} options={hier?.assortments || []} onChange={setFAss} />
        <HierFilter label="Main Group" value={fMG} options={hier?.main_groups || []} onChange={setFMG} />
        <HierFilter label="Sub Group" value={fSG} options={hier?.sub_groups || []} onChange={setFSG} />
        <HierFilter label="Product Group" value={fPG} options={hier?.product_groups || []} onChange={setFPG} />
      </FilterBar>

      {/* Type filter chips */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Chip label={`All (${recos.length})`} onClick={() => setFilter("all")}
          sx={{ fontWeight: 700, bgcolor: filter === "all" ? "#274e64" : "#eef0f3", color: filter === "all" ? "#fff" : "#5b6470" }} />
        {(Object.keys(TYPE) as RecoType[]).map(t => (
          <Chip key={t} icon={TYPE[t].icon} label={`${TYPE[t].label} (${byType[t] || 0})`} onClick={() => setFilter(t)}
            sx={{ fontWeight: 600, bgcolor: filter === t ? "#274e64" : "#eef0f3", color: filter === t ? "#fff" : "#5b6470", "& .MuiChip-icon": { color: filter === t ? "#fff" : "#5b6470" } }} />
        ))}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2, height: 2, "& .MuiLinearProgress-bar": { bgcolor: "#274e64" } }} />}

      {!loading && shown.length === 0 && (
        <Card sx={{ border: "1px solid #e6e8ec" }}>
          <CardContent sx={{ p: 5, textAlign: "center" }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1a1d21", fontFamily: "var(--font-outfit), sans-serif", mb: 0.5 }}>No recommendations yet</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#5b6470", maxWidth: 520, mx: "auto" }}>
              Recommendations appear once products, competitor prices and matches are loaded. They surface where APSO is over/under-priced, competitor price moves between scrapes, and stock-coverage gaps.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        {shown.map((r) => {
          const sev = SEV[r.severity];
          return (
            <Card key={r.id} sx={{ border: "1px solid #e6e8ec", borderLeft: `4px solid ${sev.color}` }}>
              <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: sev.bg, color: sev.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {TYPE[r.type].icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.4, flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#1a1d21" }}>{r.title}</Typography>
                      <Chip label={sev.label} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: sev.bg, color: sev.color }} />
                    </Box>
                    <Typography sx={{ fontSize: "0.8rem", color: "#5b6470", lineHeight: 1.45 }}>{r.detail}</Typography>
                    {(r.material || r.competitor) && (
                      <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
                        {r.material && <Chip label={r.material.toUpperCase()} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 600, bgcolor: "#eef0f3", color: "#274e64" }} />}
                        {r.competitor && <Chip label={r.competitor} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 600, bgcolor: "#fdf3e2", color: "#9a5d00" }} />}
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
