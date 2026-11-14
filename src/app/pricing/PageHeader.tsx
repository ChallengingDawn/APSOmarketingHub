"use client";
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

export default function PageHeader({ title, subtitle, rightSlot, badge, eyebrow, icon }: PageHeaderProps) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <Box className="animate-fade-in-up" sx={{ mb: 3.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          pb: 2.25,
          borderBottom: "1px solid #e6e8ec",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
          {Icon ? (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: "#ed1b2f",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 1px 2px rgba(237,27,47,0.25), 0 6px 16px rgba(237,27,47,0.18)",
                "& svg": { fontSize: 25 },
              }}
            >
              <Icon />
            </Box>
          ) : (
            <Box
              sx={{ width: 4, alignSelf: "stretch", minHeight: 38, borderRadius: 0.5, bgcolor: "#ed1b2f", flexShrink: 0 }}
            />
          )}
          <Box sx={{ minWidth: 0 }}>
            {eyebrow && (
              <Typography
                sx={{
                  mb: 0.4,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "#ed1b2f",
                  lineHeight: 1,
                }}
              >
                {eyebrow}
              </Typography>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
              <Typography
                component="h1"
                sx={{
                  fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                  fontWeight: 600,
                  color: "#1a1d21",
                  letterSpacing: "-0.035em",
                  fontSize: { xs: "1.6rem", md: "1.9rem" },
                  lineHeight: 1.05,
                }}
              >
                {title}
              </Typography>
              {badge && (
                <Chip
                  label={badge}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    bgcolor: "#ed1b2f",
                    color: "#fff",
                    border: "none",
                  }}
                />
              )}
            </Box>
            <Typography
              sx={{
                color: "#5b6470",
                mt: 0.6,
                fontSize: "0.9rem",
                lineHeight: 1.45,
                maxWidth: 720,
              }}
            >
              {subtitle}
            </Typography>
          </Box>
        </Box>
        {rightSlot && <Box sx={{ flexShrink: 0, pb: 0.25 }}>{rightSlot}</Box>}
      </Box>
    </Box>
  );
}
