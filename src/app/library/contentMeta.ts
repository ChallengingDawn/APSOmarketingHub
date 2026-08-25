export type ContentStatus = "draft" | "approved" | "published" | "archived";

export type ContentItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  status: ContentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Added by the scheduling flow — absent on records written before it shipped. */
  scheduledFor?: string | null;
};

export const STATUS_ORDER: ContentStatus[] = ["draft", "approved", "published", "archived"];

export const STATUS_THEME: Record<ContentStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#fff4e0", fg: "#c77700", label: "Draft" },
  approved: { bg: "#e5f3ea", fg: "#1e7e45", label: "Approved" },
  published: { bg: "#e3edf7", fg: "#2563a8", label: "Published" },
  archived: { bg: "#f0f1f3", fg: "#5b6470", label: "Archived" },
};

/** Accent per channel — drives the placeholder tint and the channel chip. */
const CHANNEL_ACCENT: Record<string, string> = {
  linkedin: "#0a66c2",
  newsletter: "#ed1b2f",
  email: "#ed1b2f",
  blog: "#274e64",
  ad: "#c77700",
  ads: "#c77700",
  product: "#1e7e45",
  seo: "#6c4bb6",
  proposal: "#8a5a2b",
  social: "#0a66c2",
};

export function channelAccent(channel: string): string {
  return CHANNEL_ACCENT[channel.toLowerCase()] ?? "#274e64";
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function channelLabel(channel: string): string {
  if (channel.toLowerCase() === "seo") return "SEO";
  if (channel.toLowerCase() === "linkedin") return "LinkedIn";
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

/** Strip markdown syntax so an excerpt reads as prose rather than raw source. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*→•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayTitle(item: ContentItem): string {
  const title = item.title?.trim();
  if (title) return title;
  const firstLine = stripMarkdown(item.body).slice(0, 90);
  return firstLine || `${channelLabel(item.channel)} piece #${item.id}`;
}

export function excerpt(item: ContentItem, max = 180): string {
  const stripped = stripMarkdown(item.body);
  const title = item.title?.trim();
  // Generators usually repeat the title as the first heading — drop it from the excerpt.
  const rest = title && stripped.startsWith(title) ? stripped.slice(title.length).trim() : stripped;
  const source = rest || stripped;
  return source.length > max ? `${source.slice(0, max).trimEnd()}…` : source;
}

export function relativeDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 31) return `${Math.round(days / 7)}w ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function shortDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function fullDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Best-effort file extension for the download anchor (data URLs and plain URLs). */
export function imageExtension(url: string): string {
  const dataMatch = url.match(/^data:image\/([a-z0-9.+-]+)/i);
  if (dataMatch) return dataMatch[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const pathMatch = url.split("?")[0].match(/\.([a-z0-9]{3,4})$/i);
  return pathMatch ? pathMatch[1].toLowerCase() : "png";
}

export type SortKey = "newest" | "oldest" | "updated" | "channel";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated", label: "Recently updated" },
  { value: "channel", label: "Channel A–Z" },
];
