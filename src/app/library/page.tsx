"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import GridViewIcon from "@mui/icons-material/GridView";
import ViewListIcon from "@mui/icons-material/ViewList";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PublishIcon from "@mui/icons-material/Publish";
import ArchiveIcon from "@mui/icons-material/Archive";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "next/link";
import ContentCard from "./ContentCard";
import ContentListRow from "./ContentListRow";
import DetailDrawer from "./DetailDrawer";
import {
  channelLabel,
  SORT_OPTIONS,
  STATUS_ORDER,
  STATUS_THEME,
  stripMarkdown,
  type ContentItem,
  type ContentStatus,
  type SortKey,
} from "./contentMeta";

const VIEW_KEY = "apsoMH:libraryView";
const FETCH_LIMIT = 200; // API caps at 200; counts below are computed from what we loaded.
const ITEM_PARAM = "item";

type ViewMode = "grid" | "list";
type StatusTab = ContentStatus | "all";

/**
 * Result of resolving `?item=<id>` when the piece is not in the loaded page.
 * `missing` = the API answered 404; `unreachable` = the lookup itself failed;
 * `invalid` = the link carried something that is not a piece id.
 */
type LinkProblem =
  | { kind: "missing"; id: number }
  | { kind: "unreachable"; id: number; detail: string }
  | { kind: "invalid"; raw: string };

/** `null` = no `?item=`; `"invalid"` = present but not a positive integer. */
type RequestedItem = number | "invalid" | null;

function parseItemParam(raw: string | null): RequestedItem {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return "invalid";
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0 ? n : "invalid";
}

const LABEL_SX = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "#5b6470",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#fff",
    fontSize: 13,
    "& fieldset": { borderColor: "#e3e6ea" },
    "&:hover fieldset": { borderColor: "#cfd5dc" },
    "&.Mui-focused fieldset": { borderColor: "#274e64" },
  },
};

function SkeletonCard() {
  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid #e3e6ea", overflow: "hidden" }}>
      <Skeleton variant="rectangular" sx={{ width: "100%", aspectRatio: "16 / 10" }} />
      <Box sx={{ p: 1.75 }}>
        <Skeleton width="85%" height={20} />
        <Skeleton width="60%" height={20} />
        <Skeleton width="100%" height={16} sx={{ mt: 1 }} />
        <Box sx={{ display: "flex", gap: 1, mt: 1.75 }}>
          <Skeleton variant="rounded" width={78} height={22} />
          <Skeleton variant="rounded" width={70} height={22} />
        </Box>
      </Box>
    </Paper>
  );
}

function StateBlock({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px dashed #d9dee4",
        borderRadius: 2,
        px: 3,
        py: 7,
        textAlign: "center",
        bgcolor: "#fbfcfd",
      }}
    >
      <Box sx={{ color: "#a8b0b9", mb: 1.5, "& svg": { fontSize: 40 } }}>{icon}</Box>
      <Typography
        sx={{
          fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
          fontWeight: 600,
          fontSize: 17,
          color: "#1a1d21",
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: "#5b6470", maxWidth: 460, mx: "auto" }}>{body}</Typography>
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Paper>
  );
}

const NOTICE_TONE = {
  warn: { bg: "#fdf4f5", border: "#f0d2d6", icon: "#ed1b2f" },
  info: { bg: "#f2f6f9", border: "#dae3ea", icon: "#274e64" },
} as const;

/** Hairline strip above the grid — explains what a deep link did or could not do. */
function InlineNotice({
  tone,
  icon,
  title,
  body,
  action,
  onDismiss,
}: {
  tone: keyof typeof NOTICE_TONE;
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const theme = NOTICE_TONE[tone];
  return (
    <Paper
      elevation={0}
      role="status"
      sx={{
        border: `1px solid ${theme.border}`,
        bgcolor: theme.bg,
        borderRadius: 2,
        px: 2,
        py: 1.25,
        mb: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ color: theme.icon, display: "flex", "& svg": { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: "1 1 260px" }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#1a1d21" }}>{title}</Typography>
        {body && <Typography sx={{ fontSize: 12.5, color: "#5b6470", mt: 0.15 }}>{body}</Typography>}
      </Box>
      {action}
      {onDismiss && (
        <IconButton size="small" onClick={onDismiss} aria-label="Dismiss notice">
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Paper>
  );
}

function LibraryWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const itemParam = searchParams.get(ITEM_PARAM);
  const queryString = searchParams.toString();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const [selected, setSelected] = useState<number[]>([]);
  const [viewingId, setViewingId] = useState<number | null>(null);
  /** A piece fetched on its own because `?item=` pointed outside the loaded page. */
  const [linkedItem, setLinkedItem] = useState<ContentItem | null>(null);
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [linkRetry, setLinkRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number; failed: number } | null>(
    null
  );

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The `?item=` value we last asked the router for. `undefined` = nothing pending.
   * router.replace lands a tick after the state change, so without this the effect
   * below would read the stale URL and close the drawer we just opened (or reopen
   * the one we just closed).
   */
  const urlIntent = useRef<number | null | undefined>(undefined);
  /** Ids already looked up one-by-one, so a failed lookup is not retried in a loop. */
  const lookedUp = useRef<Set<number>>(new Set());

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  };

  // Debounced search — 200ms after the last keystroke.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/content?limit=${FETCH_LIMIT}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? (data.items as ContentItem[]) : []);
      setError(null);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Could not reach the content service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Keep the address bar honest: `?item=<id>` while a drawer is open, gone when it closes. */
  const syncUrl = useCallback(
    (id: number | null) => {
      const current = parseItemParam(itemParam);
      const settled = typeof current === "number" ? current : null;
      // A replace already in flight is what the URL is about to say — compare against
      // that, so open-then-close in one tick cannot leave the id behind.
      const heading = urlIntent.current === undefined ? settled : urlIntent.current;
      if (heading === id && current !== "invalid") return;

      const params = new URLSearchParams(queryString);
      if (id === null) params.delete(ITEM_PARAM);
      else params.set(ITEM_PARAM, String(id));
      const next = params.toString();
      urlIntent.current = id;
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [itemParam, queryString, pathname, router]
  );

  const openItem = useCallback(
    (id: number) => {
      setViewingId(id);
      setLinkProblem(null);
      syncUrl(id);
    },
    [syncUrl]
  );

  const closeDrawer = useCallback(() => {
    setViewingId(null);
    syncUrl(null);
  }, [syncUrl]);

  const dismissLinkProblem = useCallback(() => {
    setLinkProblem(null);
    syncUrl(null);
  }, [syncUrl]);

  /** Re-run the one-off lookup for the linked id (the resolver only tries once). */
  const retryLink = useCallback(() => {
    setLinkProblem((cur) => {
      if (cur && cur.kind !== "invalid") lookedUp.current.delete(cur.id);
      return null;
    });
    setLinkRetry((n) => n + 1);
  }, []);

  const channels = useMemo(() => {
    const set = new Set(items.map((i) => i.channel));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Everything except the status tab — the tab counts are drawn from this set
  // so they stay truthful while search/channel narrow the library.
  const preStatus = useMemo(() => {
    return items.filter((item) => {
      if (channel !== "all" && item.channel !== channel) return false;
      if (!search) return true;
      const haystack = `${item.title ?? ""} ${stripMarkdown(item.body)}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [items, channel, search]);

  const counts = useMemo(() => {
    const acc: Record<StatusTab, number> = {
      all: preStatus.length,
      draft: 0,
      approved: 0,
      published: 0,
      archived: 0,
    };
    for (const item of preStatus) acc[item.status] += 1;
    return acc;
  }, [preStatus]);

  const visible = useMemo(() => {
    const rows = statusTab === "all" ? preStatus : preStatus.filter((i) => i.status === statusTab);
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "updated":
          return b.updatedAt.localeCompare(a.updatedAt);
        case "channel":
          return a.channel.localeCompare(b.channel) || b.createdAt.localeCompare(a.createdAt);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return sorted;
  }, [preStatus, statusTab, sort]);

  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Drop selections that the active filters no longer show.
  useEffect(() => {
    setSelected((cur) => {
      const keep = cur.filter((id) => visibleIds.includes(id));
      return keep.length === cur.length ? cur : keep;
    });
  }, [visibleIds]);

  const filtersActive = Boolean(search) || channel !== "all" || statusTab !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setChannel("all");
    setStatusTab("all");
  };

  const toggleSelect = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const viewing = useMemo(() => {
    if (viewingId === null) return null;
    const loaded = items.find((i) => i.id === viewingId);
    if (loaded) return loaded;
    return linkedItem && linkedItem.id === viewingId ? linkedItem : null;
  }, [items, viewingId, linkedItem]);

  // ?item=<id> → open that piece's drawer. Runs again when the fetch lands, so a
  // link followed before the library loaded is honoured rather than dropped.
  const requested = useMemo(() => parseItemParam(itemParam), [itemParam]);

  useEffect(() => {
    const target = typeof requested === "number" ? requested : null;

    // Wait for our own router.replace to land before reading the URL as truth.
    if (urlIntent.current !== undefined) {
      if (requested === "invalid" || urlIntent.current !== target) return;
      urlIntent.current = undefined;
    }

    if (requested === null) {
      // Param gone (back button, or we removed it) — the drawer follows.
      setViewingId(null);
      setLinkProblem(null);
      setResolvingId(null);
      return;
    }

    if (requested === "invalid") {
      setViewingId(null);
      setLinkProblem({ kind: "invalid", raw: (itemParam ?? "").slice(0, 40) });
      return;
    }

    if (requested === viewingId) return;
    if (items.some((i) => i.id === requested)) {
      setViewingId(requested);
      setLinkProblem(null);
      return;
    }
    if (linkedItem && linkedItem.id === requested) {
      setViewingId(requested);
      setLinkProblem(null);
      return;
    }
    // Still fetching the library — try again once the items arrive.
    if (loading) return;
    // Already asked the API about this id; don't hammer it on every re-render.
    if (lookedUp.current.has(requested)) return;

    lookedUp.current.add(requested);
    let cancelled = false;
    let settled = false;
    setResolvingId(requested);
    void (async () => {
      try {
        const res = await fetch(`/api/content/${requested}`);
        if (cancelled) return;
        if (res.status === 404) {
          setViewingId(null);
          setLinkProblem({ kind: "missing", id: requested });
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { item?: ContentItem };
        if (cancelled) return;
        if (!data.item) {
          setViewingId(null);
          setLinkProblem({ kind: "missing", id: requested });
          return;
        }
        setLinkedItem(data.item);
        setViewingId(data.item.id);
        setLinkProblem(null);
      } catch (err) {
        if (cancelled) return;
        setViewingId(null);
        setLinkProblem({
          kind: "unreachable",
          id: requested,
          detail: err instanceof Error ? err.message : "the content service did not answer",
        });
      } finally {
        if (!cancelled) {
          settled = true;
          setResolvingId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      // Abandoned before it answered (re-render, StrictMode remount) — allow a retry.
      if (!settled) lookedUp.current.delete(requested);
    };
  }, [requested, itemParam, items, loading, viewingId, linkedItem, linkRetry]);

  const setItemStatus = async (id: number, next: ContentStatus) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const { item } = (await res.json()) as { item: ContentItem };
      setItems((cur) => cur.map((i) => (i.id === id ? item : i)));
      // A deep-linked piece may live outside the loaded page — keep its copy fresh too.
      setLinkedItem((cur) => (cur && cur.id === id ? item : cur));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const bulkStatus = async (next: ContentStatus) => {
    const ids = selected;
    if (!ids.length) return;
    let done = 0;
    let failed = 0;
    setBulk({ running: true, done: 0, total: ids.length, failed: 0 });
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/content/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          });
          if (!res.ok) failed += 1;
        } catch {
          failed += 1;
        }
        done += 1;
        setBulk({ running: true, done, total: ids.length, failed });
      })
    );
    await load(true);
    if (failed === 0) {
      setSelected([]);
      setBulk(null);
    } else {
      setBulk({ running: false, done: ids.length, total: ids.length, failed });
    }
  };

  const totalLoaded = items.length;

  // A linked piece can sit outside what the grid currently shows. Say so, instead of
  // letting the drawer look like it opened on something that isn't there.
  const outsideWindow = viewing !== null && !items.some((i) => i.id === viewing.id);
  const outsideFilters =
    viewing !== null && !outsideWindow && !visibleIds.includes(viewing.id);

  return (
    <Box sx={{ p: 1 }}>
      <PageHeader
        title="Content Library"
        subtitle="Every generated piece lands here — review the visual, approve it, publish it."
        rightSlot={
          <Button
            onClick={() => load()}
            startIcon={<RefreshIcon />}
            size="small"
            sx={{ textTransform: "none", fontWeight: 600, color: "#274e64" }}
          >
            Refresh
          </Button>
        }
      />

      {/* Status pipeline */}
      <Tabs
        value={statusTab}
        onChange={(_, v: StatusTab) => setStatusTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          borderBottom: "1px solid #e3e6ea",
          mb: 2,
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13,
            minHeight: 40,
            py: 0,
            color: "#5b6470",
          },
          "& .Mui-selected": { color: "#ed1b2f" },
          "& .MuiTabs-indicator": { backgroundColor: "#ed1b2f", height: 2 },
        }}
      >
        {(["all", ...STATUS_ORDER] as StatusTab[]).map((s) => (
          <Tab
            key={s}
            value={s}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.85 }}>
                {s === "all" ? "All" : STATUS_THEME[s].label}
                <Box
                  sx={{
                    minWidth: 20,
                    px: 0.6,
                    height: 18,
                    borderRadius: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10.5,
                    fontWeight: 700,
                    bgcolor: s === "all" ? "#eef0f3" : STATUS_THEME[s].bg,
                    color: s === "all" ? "#5b6470" : STATUS_THEME[s].fg,
                  }}
                >
                  {counts[s]}
                </Box>
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* Filter bar */}
      <Paper
        elevation={0}
        sx={{
          border: "1px solid #e3e6ea",
          borderRadius: 2,
          px: 2,
          py: 1.5,
          mb: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <TextField
          size="small"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search titles and body text"
          sx={{ ...FIELD_SX, flex: "1 1 260px", minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: "#8a929c" }} />
              </InputAdornment>
            ),
            endAdornment: searchInput ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchInput("")} aria-label="Clear search">
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        <TextField
          select
          size="small"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          sx={{ ...FIELD_SX, width: 168 }}
        >
          <MenuItem value="all" sx={{ fontSize: 13 }}>
            All channels
          </MenuItem>
          {channels.map((c) => (
            <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
              {channelLabel(c)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          sx={{ ...FIELD_SX, width: 180 }}
        >
          {SORT_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        {filtersActive && (
          <Button
            size="small"
            onClick={clearFilters}
            startIcon={<FilterAltOffIcon />}
            sx={{ textTransform: "none", fontWeight: 600, color: "#5b6470" }}
          >
            Clear
          </Button>
        )}

        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.5 }}>
          {!loading && (
            <Typography sx={{ ...LABEL_SX, whiteSpace: "nowrap" }}>
              {visible.length} of {totalLoaded} piece{totalLoaded === 1 ? "" : "s"}
            </Typography>
          )}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v: ViewMode | null) => v && changeView(v)}
            sx={{
              "& .MuiToggleButton-root": {
                border: "1px solid #e3e6ea",
                px: 1,
                py: 0.4,
                color: "#5b6470",
                "&.Mui-selected": { bgcolor: "#274e64", color: "#fff", "&:hover": { bgcolor: "#1a3a4c" } },
              },
            }}
          >
            <ToggleButton value="grid" aria-label="Grid view">
              <Tooltip title="Gallery">
                <GridViewIcon sx={{ fontSize: 17 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <Tooltip title="List">
                <ViewListIcon sx={{ fontSize: 17 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Deep-link status — what ?item=<id> did, or could not do */}
      {resolvingId !== null && (
        <InlineNotice
          tone="info"
          icon={<CircularProgress size={16} sx={{ color: "#274e64" }} />}
          title={`Opening piece #${resolvingId}…`}
          body="It is not among the pieces loaded here, so it is being fetched directly."
        />
      )}

      {linkProblem?.kind === "missing" && (
        <InlineNotice
          tone="warn"
          icon={<LinkOffIcon />}
          title={`Piece #${linkProblem.id} is no longer in the library`}
          body="The link that brought you here points to a piece that has since been deleted."
          onDismiss={dismissLinkProblem}
        />
      )}

      {linkProblem?.kind === "unreachable" && (
        <InlineNotice
          tone="warn"
          icon={<ErrorOutlineIcon />}
          title={`Piece #${linkProblem.id} could not be opened`}
          body={linkProblem.detail}
          action={
            <Button
              size="small"
              onClick={retryLink}
              startIcon={<RefreshIcon />}
              sx={{ textTransform: "none", fontWeight: 600, color: "#274e64" }}
            >
              Try again
            </Button>
          }
          onDismiss={dismissLinkProblem}
        />
      )}

      {linkProblem?.kind === "invalid" && (
        <InlineNotice
          tone="warn"
          icon={<LinkOffIcon />}
          title="That link does not name a piece"
          body={`“${linkProblem.raw}” is not a piece id, so nothing could be opened.`}
          onDismiss={dismissLinkProblem}
        />
      )}

      {viewing && outsideWindow && (
        <InlineNotice
          tone="info"
          icon={<InfoOutlinedIcon />}
          title={`Showing piece #${viewing.id}, which is not among the ${FETCH_LIMIT} pieces loaded here`}
          body="It was opened straight from the link, so it does not appear in the grid below."
        />
      )}

      {viewing && outsideFilters && (
        <InlineNotice
          tone="info"
          icon={<InfoOutlinedIcon />}
          title={`Showing piece #${viewing.id}, which is outside the current filters`}
          body="Clear the filters to see it in the grid as well."
          action={
            <Button
              size="small"
              onClick={clearFilters}
              startIcon={<FilterAltOffIcon />}
              sx={{ textTransform: "none", fontWeight: 600, color: "#274e64" }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {/* Body */}
      {loading ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 2,
          }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Box>
      ) : error ? (
        <StateBlock
          icon={<ErrorOutlineIcon />}
          title="The library could not be loaded"
          body={error}
          action={
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => load()}
              sx={{ textTransform: "none", fontWeight: 600, borderColor: "#e3e6ea", color: "#274e64" }}
            >
              Try again
            </Button>
          }
        />
      ) : totalLoaded === 0 ? (
        <StateBlock
          icon={<PhotoLibraryOutlinedIcon />}
          title="Nothing in the library yet"
          body="Generate your first piece in Create Studio — drafts land here with their visuals ready to review."
          action={
            <Button
              component={Link}
              href="/create"
              variant="contained"
              disableElevation
              startIcon={<AutoAwesomeIcon />}
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#ed1b2f", "&:hover": { bgcolor: "#d81528" } }}
            >
              Open Create Studio
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <StateBlock
          icon={<FilterAltOffIcon />}
          title="No pieces match these filters"
          body="Try a different channel or status, or clear the search to see the whole library."
          action={
            <Button
              variant="outlined"
              size="small"
              onClick={clearFilters}
              sx={{ textTransform: "none", fontWeight: 600, borderColor: "#e3e6ea", color: "#274e64" }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === "grid" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 2,
          }}
        >
          {visible.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              selected={selectedSet.has(item.id)}
              onToggleSelect={toggleSelect}
              onOpen={(i) => openItem(i.id)}
            />
          ))}
        </Box>
      ) : (
        <Paper elevation={0} sx={{ border: "1px solid #e3e6ea", borderRadius: 2, overflow: "hidden" }}>
          {visible.map((item) => (
            <ContentListRow
              key={item.id}
              item={item}
              selected={selectedSet.has(item.id)}
              onToggleSelect={toggleSelect}
              onOpen={(i) => openItem(i.id)}
            />
          ))}
        </Paper>
      )}

      {!loading && !error && totalLoaded === FETCH_LIMIT && (
        <Typography sx={{ mt: 2, fontSize: 12, color: "#8a929c", textAlign: "center" }}>
          Showing the {FETCH_LIMIT} most recent pieces — older items are not loaded.
        </Typography>
      )}

      {/* Bulk selection bar */}
      {selected.length > 0 && (
        <Box sx={{ position: "sticky", bottom: 16, zIndex: 5, mt: 2, display: "flex", justifyContent: "center" }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: "#274e64",
              color: "#fff",
              borderRadius: 2,
              px: 2,
              py: 1.25,
              minWidth: { xs: "100%", md: 620 },
              boxShadow: "0 12px 30px rgba(26,29,33,.22)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mr: 0.5 }}>
                {selected.length} selected
              </Typography>
              <Button
                size="small"
                disabled={Boolean(bulk?.running)}
                startIcon={<CheckCircleIcon />}
                onClick={() => bulkStatus("approved")}
                sx={{ textTransform: "none", fontWeight: 600, color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,.45)" } }}
              >
                Approve
              </Button>
              <Button
                size="small"
                disabled={Boolean(bulk?.running)}
                startIcon={<PublishIcon />}
                onClick={() => bulkStatus("published")}
                sx={{ textTransform: "none", fontWeight: 600, color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,.45)" } }}
              >
                Publish
              </Button>
              <Button
                size="small"
                disabled={Boolean(bulk?.running)}
                startIcon={<ArchiveIcon />}
                onClick={() => bulkStatus("archived")}
                sx={{ textTransform: "none", fontWeight: 600, color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,.45)" } }}
              >
                Archive
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSelected([]);
                  setBulk(null);
                }}
                sx={{ ml: "auto", textTransform: "none", fontWeight: 600, color: "rgba(255,255,255,.8)" }}
              >
                Clear
              </Button>
            </Box>

            {bulk?.running && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={bulk.total ? (bulk.done / bulk.total) * 100 : 0}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: "rgba(255,255,255,.2)",
                    "& .MuiLinearProgress-bar": { bgcolor: "#fff" },
                  }}
                />
                <Typography sx={{ fontSize: 11.5, mt: 0.5, color: "rgba(255,255,255,.85)" }}>
                  Updating {bulk.done} of {bulk.total}…
                </Typography>
              </Box>
            )}

            {bulk && !bulk.running && bulk.failed > 0 && (
              <Typography sx={{ fontSize: 11.5, mt: 0.75, color: "#ffc9cf", fontWeight: 600 }}>
                {bulk.failed} of {bulk.total} update{bulk.failed === 1 ? "" : "s"} failed — the rest were
                applied.
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      <DetailDrawer item={viewing} onClose={closeDrawer} onStatus={setItemStatus} busy={busy} />
    </Box>
  );
}

/**
 * useSearchParams needs a Suspense boundary in the App Router — the workspace reads
 * `?item=<id>` so the Overview calendar and Approval Queue can deep-link a piece.
 */
export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 1 }}>
          <PageHeader
            title="Content Library"
            subtitle="Every generated piece lands here — review the visual, approve it, publish it."
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 2,
            }}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </Box>
        </Box>
      }
    >
      <LibraryWorkspace />
    </Suspense>
  );
}
