"use client";
import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import SearchIcon from "@mui/icons-material/Search";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

const cbOff = <CheckBoxOutlineBlankIcon fontSize="small" />;
const cbOn = <CheckBoxIcon fontSize="small" sx={{ color: "#274e64" }} />;
// Multi-select values travel as ONE comma-joined string (pages keep plain string state and
// URL params; the backend splits on commas). Values themselves never contain commas.
const splitCsv = (v: string) => (v ? v.split(",").filter(Boolean) : []);
// Big hierarchies (Product Group has thousands of entries) made the dropdown sluggish once
// every option carried a checkbox — cap what gets RENDERED; typing narrows the list as before.
const hierFilterOptions = createFilterOptions<HierOpt>({ limit: 80, stringify: (o) => `${o.number} ${o.description || ""}` });
const textFilterOptions = createFilterOptions<string>({ limit: 80 });

// ── Unified filter bar primitives ────────────────────────────────────────────
// One consistent look + behaviour for every filter across the app. Labels, widths,
// dropdown rendering and the cascade crash-guard are defined ONCE here.

export interface HierOpt { number: string; description?: string | null }

// Consistent widths so bars line up across pages.
export const FW = { search: 280, select: 150, mandant: 120, pc: 170, hier: 230 };

// Card wrapper used by every filter bar. `right` is pinned to the far end (e.g. a count chip).
export function FilterBar({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card sx={{ mb: 2, border: "1px solid #e4e9f1", borderRadius: 2 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          {children}
          {right && <><Box sx={{ flex: 1 }} />{right}</>}
        </Box>
      </CardContent>
    </Card>
  );
}

// Search box — same icon, placeholder and width everywhere.
export function SearchFilter({ value, onChange, placeholder = "Search article / product…", width = FW.search }:
  { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return (
    <TextField size="small" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      sx={{ width }} />
  );
}

// Simple single-select (Status / Confidence / Mandant / Competitor …). Has an "All" row
// unless `noAll` (e.g. the benchmark Mandant, which must be exactly M100 or M110).
export function SelectFilter({ label, value, onChange, options, width = FW.select, allLabel = "All", noAll = false }:
  { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; width?: number; allLabel?: string; noAll?: boolean }) {
  return (
    <FormControl size="small" sx={{ minWidth: width }}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value)}>
        {!noAll && <MenuItem value="">{allLabel}</MenuItem>}
        {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

// Hierarchy filter (Assortment / Main Group / Sub Group / Product Group) — MULTI-select with
// checkboxes. The value is a comma-joined string of option `number`s ("" = all). The input
// shows compact chips; the dropdown shows description bold over the number in monospace.
// Crash-guard: selections are resolved FROM the current options (a value the cascade removed
// simply doesn't render), and isOptionEqualToValue compares by number — a stale pick can't throw.
export function HierFilter({ label, value, onChange, options, width = FW.hier }:
  { label: string; value: string; onChange: (numbersCsv: string) => void; options: HierOpt[]; width?: number }) {
  const safe = Array.isArray(options) ? options : [];
  const nums = splitCsv(value);
  const selected = safe.filter((o) => nums.includes(o.number));
  return (
    <Autocomplete multiple disableCloseOnSelect size="small" sx={{ minWidth: width }} options={safe} value={selected}
      filterOptions={hierFilterOptions}
      getOptionLabel={(o) => typeof o === "string" ? o : `${o.number}${o.description ? " — " + o.description : ""}`}
      isOptionEqualToValue={(o, v) => o.number === v.number}
      onChange={(_, v) => onChange(v.map((x) => x.number).join(","))}
      renderOption={(props, o, { selected: sel }) => {
        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
        return (
          <li key={o.number} {...rest}>
            <Checkbox icon={cbOff} checkedIcon={cbOn} checked={sel} sx={{ mr: 0.5, py: 0 }} />
            <Box sx={{ lineHeight: 1.3 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#15223a" }}>{o.description || "(no description)"}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: "#5d6b85", fontFamily: "monospace", fontWeight: 600 }}>{o.number}</Typography>
            </Box>
          </li>
        );
      }}
      renderTags={(vals, getTagProps) => vals.map((o, i) => {
        const { key, ...tag } = getTagProps({ index: i });
        return <Chip key={key} {...tag} size="small" label={o.number} sx={{ height: 20, fontSize: "0.68rem", fontFamily: "monospace", fontWeight: 700 }} />;
      })}
      renderInput={(p) => <TextField {...p} label={label} placeholder={selected.length ? "" : "All"} />} />
  );
}

// Plain string Autocomplete (Profit Center / Status text lists) — MULTI-select with checkboxes.
// Value is a comma-joined string ("" = all); pages keep their plain string state.
export function TextFilter({ label, value, onChange, options, width = FW.pc }:
  { label: string; value: string; onChange: (csv: string) => void; options: string[]; width?: number }) {
  const safe = Array.isArray(options) ? options : [];
  const selected = splitCsv(value).filter((v) => safe.includes(v));
  return (
    <Autocomplete multiple disableCloseOnSelect size="small" sx={{ minWidth: width }} options={safe}
      filterOptions={textFilterOptions}
      value={selected} onChange={(_, v) => onChange(v.join(","))}
      renderOption={(props, o, { selected: sel }) => {
        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
        return (
          <li key={o} {...rest}>
            <Checkbox icon={cbOff} checkedIcon={cbOn} checked={sel} sx={{ mr: 0.5, py: 0 }} />
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{o}</Typography>
          </li>
        );
      }}
      renderTags={(vals, getTagProps) => vals.map((o, i) => {
        const { key, ...tag } = getTagProps({ index: i });
        return <Chip key={key} {...tag} size="small" label={o} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }} />;
      })}
      renderInput={(p) => <TextField {...p} label={label} placeholder={selected.length ? "" : "All"} />} />
  );
}

export function ClearFilters({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return <Button size="small" onClick={onClick} sx={{ color: "#c8463a", fontSize: 12, fontWeight: 600 }}>Clear all</Button>;
}
