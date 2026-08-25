"use client";

import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Search from "@mui/icons-material/Search";
import { EmptyState, HAIRLINE, INK, MUTED, NUMERIC, SURFACE } from "./ui";

export type SortValue = number | string | null;

export type Column<T> = {
  id: string;
  label: string;
  /** Right-aligns and applies tabular figures. */
  numeric?: boolean;
  width?: number | string;
  /** Omit to make the column non-sortable. */
  sortValue?: (row: T) => SortValue;
  render: (row: T) => ReactNode;
  /** Header tooltip — used to document derived columns in place. */
  hint?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Text the search box matches against. */
  searchText: (row: T) => string;
  searchPlaceholder: string;
  initialSort: { id: string; dir: "asc" | "desc" };
  loading: boolean;
  emptyTitle: string;
  emptyBody: string;
  maxHeight?: number;
  toolbarLeft?: ReactNode;
  skeletonRows?: number;
};

function compare(a: SortValue, b: SortValue): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1; // nulls always sink
  if (bNull) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchText,
  searchPlaceholder,
  initialSort,
  loading,
  emptyTitle,
  emptyBody,
  maxHeight = 520,
  toolbarLeft,
  skeletonRows = 8,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q.length === 0 ? rows : rows.filter((r) => searchText(r).toLowerCase().includes(q));
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return filtered;
    const getter = col.sortValue;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => sign * compare(getter(a), getter(b)));
  }, [rows, query, sort, columns, searchText]);

  const onSort = (id: string) => {
    setSort((prev) => (prev.id === id ? { id, dir: prev.dir === "asc" ? "desc" : "asc" } : { id, dir: "desc" }));
  };

  const headCellSx = {
    bgcolor: SURFACE,
    borderBottom: `1px solid ${HAIRLINE}`,
    color: MUTED,
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    py: 1.25,
    whiteSpace: "nowrap" as const,
  };

  const bodyCellSx = {
    borderBottom: `1px solid ${HAIRLINE}`,
    color: INK,
    fontSize: "0.85rem",
    py: 1.25,
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Box sx={{ minWidth: 0 }}>{toolbarLeft}</Box>
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

      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader size="small" sx={{ "& td, & th": { borderColor: HAIRLINE } }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                const active = sort.id === col.id;
                const label = col.hint ? (
                  <Tooltip title={col.hint} placement="top">
                    <Box component="span" sx={{ borderBottom: "1px dotted #b8c0c9", cursor: "help" }}>
                      {col.label}
                    </Box>
                  </Tooltip>
                ) : (
                  col.label
                );
                return (
                  <TableCell
                    key={col.id}
                    align={col.numeric ? "right" : "left"}
                    sx={{ ...headCellSx, width: col.width }}
                    sortDirection={active ? sort.dir : false}
                  >
                    {col.sortValue ? (
                      <TableSortLabel
                        active={active}
                        direction={active ? sort.dir : "desc"}
                        onClick={() => onSort(col.id)}
                        sx={{ "&.Mui-active": { color: INK }, "& .MuiTableSortLabel-icon": { fontSize: 15 } }}
                      >
                        {label}
                      </TableSortLabel>
                    ) : (
                      label
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {columns.map((col) => (
                      <TableCell key={col.id} align={col.numeric ? "right" : "left"} sx={bodyCellSx}>
                        <Skeleton
                          variant="text"
                          width={col.numeric ? 52 : `${55 + ((i * 7) % 35)}%`}
                          sx={{ ml: col.numeric ? "auto" : 0, bgcolor: "#eef0f3" }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : visible.map((row) => (
                  <TableRow key={rowKey(row)} sx={{ "&:hover": { bgcolor: "#fafbfc" } }}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        align={col.numeric ? "right" : "left"}
                        sx={{ ...bodyCellSx, ...(col.numeric ? NUMERIC : null) }}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && visible.length === 0 && (
        <EmptyState
          title={rows.length === 0 ? emptyTitle : "No rows match your search"}
          body={rows.length === 0 ? emptyBody : `Nothing matched “${query.trim()}”. Clear the search box to see all ${rows.length} rows.`}
        />
      )}

      {!loading && visible.length > 0 && (
        <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
            {visible.length === rows.length
              ? `${rows.length} row${rows.length === 1 ? "" : "s"}`
              : `${visible.length} of ${rows.length} rows`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
