"use client";
import { usePathname } from "next/navigation";
import { PRICING_SECTIONS } from "@/app/hubApps";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import DashboardIcon from "@mui/icons-material/Dashboard";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import TableChartIcon from "@mui/icons-material/TableChart";
import BarChartIcon from "@mui/icons-material/BarChart";
import JoinInnerIcon from "@mui/icons-material/JoinInner";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import HistoryIcon from "@mui/icons-material/History";
import SyncIcon from "@mui/icons-material/Sync";
import StorefrontIcon from "@mui/icons-material/Storefront";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SettingsIcon from "@mui/icons-material/Settings";
import InsightsIcon from "@mui/icons-material/Insights";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DocumentScannerIcon from "@mui/icons-material/DocumentScanner";

// Central icon map — pages pass a key string, keeping per-page imports clean.
const ICONS = {
  dashboard: DashboardIcon,
  alerts: NotificationsActiveIcon,
  trend: ShowChartIcon,
  products: Inventory2Icon,
  benchmark: TableChartIcon,
  charts: BarChartIcon,
  matches: JoinInnerIcon,
  pending: PendingActionsIcon,
  unmatched: LinkOffIcon,
  logs: HistoryIcon,
  scraper: SyncIcon,
  competitors: StorefrontIcon,
  stock: WarehouseIcon,
  settings: SettingsIcon,
  analytics: InsightsIcon,
  repricing: PriceChangeIcon,
  purchasing: ShoppingCartIcon,
  ocr: DocumentScannerIcon,
} as const;

export type PageIconKey = keyof typeof ICONS;

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
  badge?: string;
  /** Small uppercase section label above the title (e.g. "Pricing Intelligence"). */
  eyebrow?: string;
  /** Key into the central icon map, rendered in the solid red tile beside the title. */
  icon?: PageIconKey;
}

/** The section a Pricing page belongs to (PRICING_SECTIONS), for its colours - Pricing's own red where none answers. */
function toneHere(path: string): { fg: string; tint: string } {
  const s = PRICING_SECTIONS.find((x) => x.pages.some((p) => path === p.href || path.startsWith(`${p.href}/`)));
  return s ? { fg: s.fg, tint: s.tint } : { fg: "#c8463a", tint: "#fde9e6" };
}

/**
 * The page's header in the hub's own look (SARCLA 14.11.2026: "design is nothing alike the platform yet"): the glyph in
 * its section's colours, the section named above the title in the same colour, the title as every hub page sets it, one
 * line of context - and the page's controls on the right, on the title's baseline. The same props as the PricingHub's
 * header, so every page took it without a change.
 */
export default function PageHeader({ title, subtitle, rightSlot, badge, eyebrow, icon }: PageHeaderProps) {
  const Icon = icon ? ICONS[icon] : null;
  const { fg, tint } = toneHere(usePathname() ?? "");
  return (
    <Box className="animate-fade-in-up" sx={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: { xs: 2.5, md: 3 },
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, minWidth: 0 }}>
        {Icon && (
          <Box sx={{
            width: 52, height: 52, borderRadius: "16px", flexShrink: 0, display: "grid", placeItems: "center",
            background: `linear-gradient(140deg, ${fg}b3, ${fg})`, color: "#fff", boxShadow: `0 10px 22px ${tint}`,
            "& svg": { fontSize: 27 },
          }}><Icon /></Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          {eyebrow && (
            <Typography sx={{ mb: 0.35, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: fg, lineHeight: 1.2 }}>
              {eyebrow}
            </Typography>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Typography component="h1" sx={{
              fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#15223a",
              letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.85rem" }, lineHeight: 1.1,
            }}>{title}</Typography>
            {badge && (
              <Chip label={badge} size="small" sx={{
                height: 22, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em",
                bgcolor: tint, color: fg, border: `1px solid ${fg}33`,
              }} />
            )}
          </Box>
          {subtitle && (
            <Typography sx={{ color: "#5d6b85", mt: 0.6, fontSize: "0.92rem", lineHeight: 1.5, maxWidth: 760 }}>{subtitle}</Typography>
          )}
        </Box>
      </Box>
      {rightSlot && <Box sx={{ flexShrink: 0, pb: 0.25 }}>{rightSlot}</Box>}
    </Box>
  );
}
