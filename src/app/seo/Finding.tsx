"use client";

/**
 * FINDING LIST — the scannable primitive four of the five sub-apps share.
 *
 * The old cockpit put six to nine numeric columns side by side and called it a
 * row. That is a spreadsheet, not a work list. A finding row carries exactly
 * four things at rest:
 *
 *   score      the analysis's own ranking number, so the order is legible
 *   subject    the query or URL the finding is about
 *   reason     ONE line saying why it is on the list
 *   action     ONE primary button, visually dominant
 *
 * Everything else — the per-metric breakdown, the competing URLs, the evidence
 * figures — lives behind "Details" and is rendered from the analysis output
 * unchanged. Nothing here computes a number.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Search from "@mui/icons-material/Search";
import UnfoldMore from "@mui/icons-material/UnfoldMore";

import { DISPLAY, HAIRLINE, INK, MONO, MUTED, NAVY, NUMERIC, SURFACE } from "./ui";

export type Finding = {
  id: string;
  /** The analysis's own ranking number, already formatted. */
  score: string;
  /** What that number is, in two or three words. */
  scoreCaption: string;
  /** Accent for the score — severity colour, or NAVY for a neutral opportunity. */
  scoreTone?: string;
  subject: string;
  /** URLs are rendered monospaced so paths stay comparable down the column. */
  subjectMono?: boolean;
  /** Small badge before the reason — provenance or classification. */
  tag?: ReactNode;
  /** Exactly one line. Anything longer belongs in `details`. */
  reason: ReactNode;
  /**
   * One primary button. `external: true` means the href leaves the hub — a live
   * page on the shop, not a route — so it opens in a new tab and does not go
   * through next/link, which would try to client-navigate to another origin.
   */
  action: { href: string; label: string; external?: boolean };
  /** An optional second control beside the link — "Start", and nothing else so far. */
  secondary?: ReactNode;
  details: ReactNode;
  /** Text the list's search box matches against. */
  searchText: string;
};

function FindingRow({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const tone = finding.scoreTone ?? NAVY;

  return (
    <Box sx={{ borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "72px minmax(0, 1fr)", md: "88px minmax(0, 1fr) auto" },
          columnGap: { xs: 2, md: 3 },
          rowGap: 1.5,
          alignItems: "center",
          px: { xs: 2, md: 3 },
          py: { xs: 2.25, md: 2.5 },
          transition: "background-color 120ms",
          "&:hover": { bgcolor: "#fafbfc" },
        }}
      >
        {/* score */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: DISPLAY,
              fontSize: "1.5rem",
              fontWeight: 600,
              color: tone,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              ...NUMERIC,
            }}
          >
            {finding.score}
          </Typography>
          <Typography
            sx={{
              mt: 0.35,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: MUTED,
              lineHeight: 1.3,
            }}
          >
            {finding.scoreCaption}
          </Typography>
        </Box>

        {/* subject + one-line reason */}
        <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", md: "auto" } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Tooltip title={finding.subject} placement="top-start">
              <Typography
                sx={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: INK,
                  fontFamily: finding.subjectMono ? MONO : undefined,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {finding.subject}
              </Typography>
            </Tooltip>
            {finding.tag}
          </Box>
          <Typography
            component="div"
            sx={{
              mt: 0.6,
              fontSize: "0.82rem",
              color: MUTED,
              lineHeight: 1.55,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              ...NUMERIC,
            }}
          >
            {finding.reason}
          </Typography>
        </Box>

        {/* one dominant action, one quiet one */}
        <Box
          sx={{
            gridColumn: { xs: "1 / -1", md: "auto" },
            display: "flex",
            alignItems: "center",
            justifyContent: { xs: "flex-start", md: "flex-end" },
            gap: 1,
          }}
        >
          <Button
            {...(finding.action.external
              ? { component: "a" as const, href: finding.action.href, target: "_blank", rel: "noopener noreferrer" }
              : { component: Link, href: finding.action.href })}
            variant="contained"
            disableElevation
            sx={{
              bgcolor: NAVY,
              textTransform: "none",
              fontSize: "0.83rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              px: 2,
              py: 0.9,
              "&:hover": { bgcolor: "#1d3c4e" },
            }}
          >
            {finding.action.label}
          </Button>
          {finding.secondary}
          <Button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            variant="text"
            disableRipple
            endIcon={<UnfoldMore sx={{ fontSize: 15 }} />}
            sx={{
              color: MUTED,
              textTransform: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              minWidth: 0,
              px: 1,
              "&:hover": { bgcolor: "transparent", color: INK },
            }}
          >
            {open ? "Hide" : "Details"}
          </Button>
        </Box>
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 2.5, md: 3 },
            bgcolor: SURFACE,
            borderTop: `1px solid ${HAIRLINE}`,
          }}
        >
          {finding.details}
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * The list itself: a heading, a search box, the rows, and a footer count. An
 * empty `items` is not an error — the caller supplies the wording that says so.
 */
/** Rows per page, and the choices offered. 25 fills a screen without filling a day. */
const PER_PAGE_DEFAULT = 25;
const PER_PAGE_CHOICES = [10, 25, 50, 100];

/**
 * The shared footer: which slice you are looking at, and how to move.
 *
 * It states the range rather than just the page number, because "1-25 of 187"
 * tells you how much is left and "page 1 of 8" makes you work it out.
 */
export function Pager({
  total, filteredFrom, noun, page, perPage, onPage, onPerPage,
}: {
  total: number;
  /** Set when a search has narrowed the list, so the footer can say so. */
  filteredFrom: number | null;
  noun: string;
  page: number;
  perPage: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : page * perPage + 1;
  const to = Math.min(total, (page + 1) * perPage);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
        {from}-{to} of {total}
        {filteredFrom === null ? "" : ` (filtered from ${filteredFrom})`} {noun}
        {total === 1 ? "" : "s"}
      </Typography>

      <Box sx={{ flex: 1 }} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Per page</Typography>
        {PER_PAGE_CHOICES.map((n) => (
          <Box
            key={n}
            component="button"
            type="button"
            onClick={() => onPerPage(n)}
            aria-pressed={n === perPage}
            sx={{
              border: "none", cursor: "pointer", px: 0.9, py: 0.3, borderRadius: "7px",
              fontSize: "0.74rem", fontWeight: 600, fontFamily: "inherit",
              color: n === perPage ? INK : MUTED,
              bgcolor: n === perPage ? "rgba(21,34,58,.08)" : "transparent",
            }}
          >
            {n}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
        <IconButton size="small" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, minWidth: 74, textAlign: "center" }}>
          Page {page + 1} of {pages}
        </Typography>
        <IconButton size="small" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function FindingList({
  heading,
  caption,
  items,
  loading,
  empty,
  filters,
  maxHeight = 760,
  searchPlaceholder = "Search findings",
}: {
  heading: string;
  caption: ReactNode;
  items: Finding[];
  loading: boolean;
  /** Rendered when the list has no rows — good news or otherwise, caller's words. */
  empty: ReactNode;
  /** Quiet secondary controls shown under the heading. */
  filters?: ReactNode;
  maxHeight?: number;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return items;
    return items.filter((i) => i.searchText.toLowerCase().includes(q));
  }, [items, query]);

  // Searching or reloading must not leave you on page 9 of a 2-page result,
  // which looks exactly like "no findings".
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const current = Math.min(page, pageCount - 1);
  useEffect(() => { setPage(0); }, [query, items]);

  const shown = useMemo(
    () => visible.slice(current * perPage, current * perPage + perPage),
    [visible, current, perPage],
  );

  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          px: { xs: 2, md: 3 },
          py: 2.25,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {heading}
          </Typography>
          <Typography component="div" sx={{ mt: 0.4, fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>
            {caption}
          </Typography>
          {filters !== undefined && <Box sx={{ mt: 1.75 }}>{filters}</Box>}
        </Box>

        <TextField
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 17, color: MUTED }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: { xs: "100%", sm: 260 },
            "& .MuiOutlinedInput-root": { fontSize: "0.85rem", bgcolor: "#fff" },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: HAIRLINE },
          }}
        />
      </Box>

      {loading && (
        <Box>
          {Array.from({ length: 6 }, (_, i) => (
            <Box
              key={`sk-${i}`}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "72px minmax(0, 1fr)", md: "88px minmax(0, 1fr) 190px" },
                columnGap: 3,
                alignItems: "center",
                px: { xs: 2, md: 3 },
                py: 2.5,
                borderBottom: `1px solid ${HAIRLINE}`,
              }}
            >
              <Skeleton variant="text" width={56} height={28} sx={{ bgcolor: "#eef0f3" }} />
              <Box>
                <Skeleton variant="text" width={`${45 + ((i * 9) % 35)}%`} sx={{ bgcolor: "#eef0f3" }} />
                <Skeleton variant="text" width={`${30 + ((i * 11) % 30)}%`} sx={{ bgcolor: "#eef0f3" }} />
              </Box>
              <Skeleton
                variant="rounded"
                height={34}
                sx={{ bgcolor: "#eef0f3", display: { xs: "none", md: "block" } }}
              />
            </Box>
          ))}
        </Box>
      )}

      {!loading && visible.length > 0 && (
        <Box sx={{ maxHeight, overflowY: "auto" }}>
          {shown.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </Box>
      )}

      {!loading && visible.length === 0 && items.length > 0 && (
        <Box sx={{ px: 3, py: 6, textAlign: "center" }}>
          <Typography sx={{ fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 600, color: INK }}>
            No finding matches your search
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: "0.85rem", color: MUTED }}>
            Nothing matched “{query.trim()}”. Clear the search box to see all {items.length} row
            {items.length === 1 ? "" : "s"}.
          </Typography>
        </Box>
      )}

      {!loading && items.length === 0 && empty}

      {!loading && visible.length > 0 && (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.75, borderTop: `1px solid ${HAIRLINE}`, bgcolor: SURFACE }}>
          <Pager
            total={visible.length}
            filteredFrom={visible.length === items.length ? null : items.length}
            noun="finding"
            page={current}
            perPage={perPage}
            onPage={setPage}
            onPerPage={(n) => { setPerPage(n); setPage(0); }}
          />
        </Box>
      )}
    </Box>
  );
}

/* ── details-panel building blocks ─────────────────────────────────────── */

/** A labelled figure grid — the standard way a Details panel shows its inputs. */
export function DetailGrid({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
        gap: 0,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
        bgcolor: "#fff",
        overflow: "hidden",
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            px: 2.25,
            py: 2,
            minWidth: 0,
            borderRight: `1px solid ${HAIRLINE}`,
            borderBottom: `1px solid ${HAIRLINE}`,
          }}
        >
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {item.label}
          </Typography>
          <Typography sx={{ mt: 0.6, fontSize: "1rem", fontWeight: 600, color: INK, ...NUMERIC }}>
            {item.value}
          </Typography>
          {item.note !== undefined && (
            <Typography sx={{ mt: 0.35, fontSize: "0.75rem", color: MUTED, lineHeight: 1.45 }}>
              {item.note}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** A paragraph inside a Details panel — the recommendation, or the method note. */
export function DetailNote({ children }: { children: ReactNode }) {
  return (
    <Typography component="div" sx={{ mb: 2, fontSize: "0.86rem", color: INK, lineHeight: 1.75, maxWidth: 900 }}>
      {children}
    </Typography>
  );
}
