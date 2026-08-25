"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryToggleOffIcon from "@mui/icons-material/HistoryToggleOff";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import PageHeader from "@/app/PageHeader";

const NAVY = "#274e64";
const INK = "#1a1d21";
const MUTED = "#5b6470";
const HAIRLINE = "#e3e6ea";
const SURFACE = "#f5f6f8";

export type AuditEvent = {
  id: number;
  actor: string | null;
  action: string;
  /** Best-effort target extracted from the event's JSON detail. */
  target: string | null;
  /** Pretty-printed JSON of the detail column, or null when it was NULL. */
  detail: string | null;
  /** ISO-8601 UTC timestamp of created_at. */
  createdAt: string;
};

type Props = {
  events: AuditEvent[];
  /** Message from the database when the table could not be read at all. */
  error: string | null;
  /** Row cap applied by the query, so the UI can say when it is truncated. */
  limit: number;
};

const ALL = "__all__";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </Typography>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, bgcolor: "#fff" }}>{children}</Box>
  );
}

/** Explicit, non-fabricated state shown instead of a table. */
function StateBlock({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: React.ReactNode[];
}) {
  return (
    <Box sx={{ px: 4, py: 6, textAlign: "center" }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          bgcolor: SURFACE,
          border: `1px solid ${HAIRLINE}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
          fontSize: "1.15rem",
          fontWeight: 600,
          color: INK,
          letterSpacing: "-0.01em",
          mb: 1,
        }}
      >
        {title}
      </Typography>
      {lines.map((line, i) => (
        <Typography
          key={i}
          sx={{ fontSize: "0.88rem", color: MUTED, maxWidth: 620, mx: "auto", lineHeight: 1.6, mb: 0.75 }}
        >
          {line}
        </Typography>
      ))}
    </Box>
  );
}

export default function AuditLog({ events, error, limit }: Props) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>(ALL);
  const [actor, setActor] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const actions = useMemo(
    () => Array.from(new Set(events.map((e) => e.action))).sort(),
    [events],
  );
  const actors = useMemo(
    () => Array.from(new Set(events.map((e) => e.actor ?? "(system)"))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return events.filter((e) => {
      if (action !== ALL && e.action !== action) return false;
      if (actor !== ALL && (e.actor ?? "(system)") !== actor) return false;
      const ts = new Date(e.createdAt).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      if (needle) {
        const haystack = [e.actor ?? "", e.action, e.target ?? "", e.detail ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [events, search, action, actor, from, to]);

  const filtersActive =
    search.trim() !== "" || action !== ALL || actor !== ALL || from !== "" || to !== "";

  const exportCsv = () => {
    const header = ["timestamp_utc", "actor", "action", "target", "detail_json"];
    const body = filtered.map((e) =>
      [e.createdAt, e.actor ?? "", e.action, e.target ?? "", e.detail ?? ""]
        .map(csvCell)
        .join(","),
    );
    const csv = [header.join(","), ...body].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `apsomh-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ py: 4, px: { xs: 2, md: 4 } }}>
      <PageHeader
        title="Audit"
        subtitle="Every event recorded in the apsomh_audit table — actor, action, target and timestamp, exactly as stored. Nothing on this page is generated or illustrative."
        rightSlot={
          !error && events.length > 0 ? (
            <Button
              onClick={exportCsv}
              variant="outlined"
              startIcon={<DownloadIcon />}
              sx={{
                borderColor: NAVY,
                color: NAVY,
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { borderColor: "#1b3a4b", bgcolor: "#f0f4f7" },
              }}
            >
              Export {filtered.length} row{filtered.length === 1 ? "" : "s"} (CSV)
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Panel>
          <StateBlock
            icon={<ReportProblemIcon sx={{ fontSize: 26, color: "#ed1b2f" }} />}
            title="Audit store unreachable"
            lines={[
              "The apsomh_audit table could not be read, so this page has nothing to show. No events are displayed rather than a stand-in.",
              <>
                Connect the database by setting <strong>DATABASE_URL</strong> (or{" "}
                <strong>PGHOST</strong> / <strong>PGUSER</strong> / <strong>PGPASSWORD</strong>) on
                this service, then reload.
              </>,
              <Box
                key="err"
                component="code"
                sx={{
                  display: "inline-block",
                  mt: 1,
                  px: 1.25,
                  py: 0.75,
                  bgcolor: SURFACE,
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 1,
                  fontSize: "0.78rem",
                  color: INK,
                  wordBreak: "break-word",
                }}
              >
                {error}
              </Box>,
            ]}
          />
        </Panel>
      ) : events.length === 0 ? (
        <Panel>
          <StateBlock
            icon={<HistoryToggleOffIcon sx={{ fontSize: 26, color: NAVY }} />}
            title="No audit events recorded yet"
            lines={[
              "The apsomh_audit table exists and is empty — zero rows. This page reads it directly and will list events as soon as they are written.",
              <>
                Nothing in the app writes to it today. Events appear once the actions worth tracing
                (content generated, approved, published, brain edited, user changed) insert a row
                with <strong>actor</strong>, <strong>action</strong> and a JSON{" "}
                <strong>detail</strong>.
              </>,
            ]}
          />
        </Panel>
      ) : (
        <>
          {/* ── Filters ── */}
          <Box sx={{ mb: 2 }}>
            <SectionLabel>Filter</SectionLabel>
            <Box
              sx={{
                display: "flex",
                gap: 1.5,
                flexWrap: "wrap",
                alignItems: "center",
                mt: 1,
              }}
            >
              <TextField
                size="small"
                label="Search"
                placeholder="actor, action, target or detail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ minWidth: 260 }}
              />
              <TextField
                size="small"
                select
                label="Action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value={ALL}>All actions</MenuItem>
                {actions.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                select
                label="Actor"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value={ALL}>All actors</MenuItem>
                {actors.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                type="date"
                label="From"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {filtersActive && (
                <Button
                  onClick={() => {
                    setSearch("");
                    setAction(ALL);
                    setActor(ALL);
                    setFrom("");
                    setTo("");
                  }}
                  sx={{ textTransform: "none", fontWeight: 600, color: MUTED }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Box>

          <Panel>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2.5,
                py: 1.75,
                borderBottom: `1px solid ${HAIRLINE}`,
                flexWrap: "wrap",
              }}
            >
              <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: NAVY }} />
              <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>
                Event log
              </Typography>
              <Chip
                label={`${filtered.length} of ${events.length}`}
                size="small"
                sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: SURFACE, color: MUTED }}
              />
              <Box sx={{ flex: 1 }} />
              {events.length >= limit && (
                <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
                  Showing the {limit} most recent rows
                </Typography>
              )}
            </Box>

            {filtered.length === 0 ? (
              <StateBlock
                icon={<HistoryToggleOffIcon sx={{ fontSize: 26, color: NAVY }} />}
                title="No events match these filters"
                lines={[
                  `The log holds ${events.length} event${events.length === 1 ? "" : "s"}; none of them match the current filter.`,
                ]}
              />
            ) : (
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: SURFACE }}>
                      <TableCell sx={{ width: 44, borderColor: HAIRLINE }} />
                      <TableCell sx={{ fontWeight: 700, color: INK, borderColor: HAIRLINE, whiteSpace: "nowrap" }}>
                        Timestamp
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: INK, borderColor: HAIRLINE }}>Actor</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: INK, borderColor: HAIRLINE }}>Action</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: INK, borderColor: HAIRLINE }}>Target</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((e) => {
                      const isOpen = expanded === e.id;
                      return [
                        <TableRow
                          key={`row-${e.id}`}
                          hover
                          onClick={() => setExpanded(isOpen ? null : e.id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell sx={{ borderColor: HAIRLINE, pr: 0 }}>
                            <IconButton size="small" aria-label={isOpen ? "Collapse" : "Expand"}>
                              {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={{ borderColor: HAIRLINE, whiteSpace: "nowrap", fontSize: "0.82rem", color: INK }}>
                            {formatTimestamp(e.createdAt)}
                          </TableCell>
                          <TableCell sx={{ borderColor: HAIRLINE, fontSize: "0.85rem", color: e.actor ? INK : MUTED }}>
                            {e.actor ?? "(system)"}
                          </TableCell>
                          <TableCell sx={{ borderColor: HAIRLINE }}>
                            <Chip
                              label={e.action}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                bgcolor: "#e8f0f4",
                                color: NAVY,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ borderColor: HAIRLINE, maxWidth: 420, fontSize: "0.85rem", color: e.target ? INK : MUTED }}>
                            <Typography noWrap sx={{ fontSize: "0.85rem" }}>
                              {e.target ?? "—"}
                            </Typography>
                          </TableCell>
                        </TableRow>,
                        <TableRow key={`detail-${e.id}`}>
                          <TableCell
                            colSpan={5}
                            sx={{ p: 0, borderBottom: isOpen ? `1px solid ${HAIRLINE}` : "none" }}
                          >
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2.5, bgcolor: "#fafbfc" }}>
                                <SectionLabel>Stored detail (jsonb)</SectionLabel>
                                <Box
                                  component="pre"
                                  sx={{
                                    mt: 1,
                                    mb: 0,
                                    p: 2,
                                    bgcolor: "#fff",
                                    border: `1px solid ${HAIRLINE}`,
                                    borderRadius: 1,
                                    fontSize: "0.78rem",
                                    lineHeight: 1.6,
                                    color: INK,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    overflowX: "auto",
                                  }}
                                >
                                  {e.detail ?? "NULL — this event was written without a detail payload."}
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>,
                      ];
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Panel>
        </>
      )}
    </Box>
  );
}
