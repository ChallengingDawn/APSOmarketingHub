"use client";
// The kinds of to-do a content project holds (SARCLA 08.11.2026: "for me a piece is a to-do"; "each type of content
// should be different"): every content type has its own face here - glyph and colour - and a plain action has one too.
// The Page builder (09.11.2026, the type for a page already on the webshop) has blocks for a glyph, beside the landing page.

import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import ViewDayOutlinedIcon from "@mui/icons-material/ViewDayOutlined";
import ViewQuiltOutlinedIcon from "@mui/icons-material/ViewQuiltOutlined";
import WebOutlinedIcon from "@mui/icons-material/WebOutlined";

import { TINT, type Tint } from "@/app/uc/report/ui";
import { CONTENT_BY_KEY, OFFERED_CONTENT_TYPES } from "@/lib/content/contentTypes";
import { TASK_KIND } from "@/lib/content/pieceRules";

const GLYPH: Record<string, React.ElementType> = {
  [TASK_KIND]: ChecklistOutlinedIcon, "landing-page": WebOutlinedIcon, "product-page": Inventory2OutlinedIcon,
  "page-refresh": ViewQuiltOutlinedIcon, "blog-article": ArticleOutlinedIcon, "linkedin-post": ShareOutlinedIcon,
  "social-post": ShareOutlinedIcon, newsletter: MailOutlineIcon, "search-ad": AdsClickOutlinedIcon,
  "consolidation-brief": MergeTypeOutlinedIcon, banner: ViewDayOutlinedIcon, video: MovieOutlinedIcon,
};
const TONE: Record<string, Tint> = {
  [TASK_KIND]: "slate", "landing-page": "blue", "product-page": "blue", "page-refresh": "blue", "consolidation-brief": "slate",
  "blog-article": "green", "linkedin-post": "purple", "social-post": "purple", newsletter: "amber", "search-ad": "amber",
  banner: "pink", video: "pink",
};

export type Kind = { key: string; label: string; language: boolean };

/** Every kind a new to-do can be: the content types offered, then a plain action (SARCLA 08.11.2026: "don't call it
 * task, call it action" - it is an action of the plan, with its ticket). The stored key stays "task". */
export const KINDS: Kind[] = [
  ...OFFERED_CONTENT_TYPES.map((t) => ({ key: t.key, label: t.label, language: true })),
  { key: TASK_KIND, label: "Action", language: false },
];

export const kindLabel = (key: string | null) => (key === TASK_KIND || !key ? "Action" : CONTENT_BY_KEY[key]?.label ?? key);

/** The kind's glyph on its tinted tile. */
export function KindTile({ kind, size = 34 }: { kind: string | null; size?: number }) {
  const k = kind ?? TASK_KIND;
  const G = GLYPH[k] ?? ChecklistOutlinedIcon;
  const t = TINT[TONE[k] ?? "slate"];
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.32, display: "inline-grid", placeItems: "center", flexShrink: 0, background: t.bg, color: t.fg }}>
      <G style={{ fontSize: size * 0.55 }} />
    </span>
  );
}
