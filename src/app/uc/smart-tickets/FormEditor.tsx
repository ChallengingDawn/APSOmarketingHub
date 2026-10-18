"use client";

// SMART SUB-TICKET - THE CREATE FORM (SARCLA 18.10.2026: "another tab, Create form, put the design here so we can tweak
// the properties and so forth"). The Smart Sub-Ticket card reads the PUBLISHED design from HubDB when it opens; here
// the design is changed one piece at a time into a draft (the hub refuses request bodies over 8 KB), checked against
// HubSpot's ticket properties, pipelines and owners, and published. Margin % and Target price stay required on GQS.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, INK, MUTED, RED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import type { Field, FieldType, SmartForm, Section } from "@/lib/smartTickets/form";

type Prop = { name: string; label: string; fieldType: string; options: string[] };
type Catalog = { properties: Prop[]; pipelines: { id: string; label: string; stages: { id: string; label: string }[] }[]; owners: { id: string; name: string }[] };
type State = {
  draft: SmartForm; live: { version: number; at: string; by: string } | null; changed: string[]; problems: string[];
  history: { version: number; at: string; by: string }[]; catalog: Catalog; admin: boolean;
};
type Piece = { section: Section; key: string | null; label: string };

const LOCKED = ["margin__", "target_price"];
const TYPES: { v: FieldType; l: string }[] = [
  { v: "text", l: "Text" }, { v: "textarea", l: "Long text" }, { v: "number", l: "Number" },
  { v: "date", l: "Date" }, { v: "yesno", l: "Yes / No" }, { v: "select", l: "List" },
];
const cell = { ...bodyCell, fontSize: "0.82rem", py: 0.75, verticalAlign: "top" } as const;
const small = { size: "small" as const, fullWidth: true };
const csv = (a: string[]) => a.join(", ");
const uncsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function move<T>(rows: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function PropPicker({ props, value, onChange, label }: { props: Prop[]; value: string; onChange: (v: string) => void; label?: string }) {
  const sel = props.find((p) => p.name === value) ?? null;
  return (
    <Autocomplete size="small" options={props} value={sel} onChange={(_, p) => onChange(p?.name ?? "")}
      getOptionLabel={(p) => `${p.label} (${p.name})`} isOptionEqualToValue={(a, b) => a.name === b.name}
      renderInput={(p) => <TextField {...p} label={label} placeholder="property" error={!!value && !sel} helperText={value && !sel ? `${value} - not in HubSpot` : undefined} />} />
  );
}

function RowTools({ i, n, onMove, onDelete, locked }: { i: number; n: number; onMove: (d: -1 | 1) => void; onDelete: () => void; locked?: boolean }) {
  return (
    <Box sx={{ display: "flex", whiteSpace: "nowrap" }}>
      <IconButton size="small" disabled={i === 0} onClick={() => onMove(-1)} aria-label="Up"><ArrowUpwardIcon sx={{ fontSize: 16 }} /></IconButton>
      <IconButton size="small" disabled={i === n - 1} onClick={() => onMove(1)} aria-label="Down"><ArrowDownwardIcon sx={{ fontSize: 16 }} /></IconButton>
      <Tooltip title={locked ? "Required on every GQS form - cannot be removed" : "Remove"}>
        <span><IconButton size="small" disabled={locked} onClick={onDelete} aria-label="Remove"><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></span>
      </Tooltip>
    </Box>
  );
}

/** A form's fields: label, property, type, choices, required, customer autofill - in order. */
function FieldsEditor({ value, props, gqs, onChange }: { value: Field[]; props: Prop[]; gqs: boolean; onChange: (v: Field[]) => void }) {
  const set = (i: number, patch: Partial<Field>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <>
      <Table size="small">
        <TableHead><TableRow>{["#", "Label", "HubSpot property", "Type", "Choices (lists)", "Required", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {value.map((x, i) => {
            const locked = gqs && LOCKED.includes(x.f);
            const prop = props.find((p) => p.name === x.f);
            return (
              <TableRow key={i}>
                <TableCell sx={{ ...cell, color: MUTED }}>{i + 1}</TableCell>
                <TableCell sx={{ ...cell, minWidth: 180 }}><TextField {...small} value={x.l} onChange={(e) => set(i, { l: e.target.value })} /></TableCell>
                <TableCell sx={{ ...cell, minWidth: 260 }}>{locked ? <Typography sx={{ fontSize: "0.82rem", pt: 1 }}>{prop?.label ?? x.f} <span style={{ color: MUTED }}>({x.f})</span></Typography> : <PropPicker props={props} value={x.f} onChange={(f) => set(i, { f })} />}</TableCell>
                <TableCell sx={{ ...cell, minWidth: 120 }}>
                  <TextField select {...small} value={x.t} onChange={(e) => set(i, { t: e.target.value as FieldType })} disabled={locked}>
                    {TYPES.map((t) => <MenuItem key={t.v} value={t.v}>{t.l}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell sx={{ ...cell, minWidth: 200 }}>
                  {x.t === "select" ? (
                    <>
                      <TextField {...small} value={csv(x.opts ?? [])} onChange={(e) => set(i, { opts: uncsv(e.target.value) })} placeholder="choice, choice" />
                      {!!prop?.options.length && <Button size="small" sx={{ textTransform: "none", p: 0, mt: 0.25 }} onClick={() => set(i, { opts: prop.options })}>Use HubSpot&apos;s {prop.options.length}</Button>}
                    </>
                  ) : <Typography sx={{ fontSize: "0.78rem", color: MUTED, pt: 1 }}>-</Typography>}
                </TableCell>
                <TableCell sx={cell}>
                  <Checkbox size="small" checked={!!x.req || locked} disabled={locked} onChange={(e) => set(i, { req: e.target.checked })} />
                  {x.f === "customer_number_customer_name" && <Tooltip title="Filled with the ticket's company"><span><Checkbox size="small" checked={x.autofill === "customer"} onChange={(e) => set(i, { autofill: e.target.checked ? "customer" : undefined })} /></span></Tooltip>}
                </TableCell>
                <TableCell sx={cell}><RowTools i={i} n={value.length} locked={locked} onMove={(d) => onChange(move(value, i, d))} onDelete={() => onChange(value.filter((_, j) => j !== i))} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", mt: 1 }} onClick={() => onChange([...value, { f: "", l: "", t: "text" }])}>Add a field</Button>
    </>
  );
}

/** A list section: its rows, each column an input. */
function RowsEditor<T>({ value, onChange, cols, blank }: {
  value: T[]; onChange: (v: T[]) => void; blank: T;
  cols: { label: string; width?: number; render: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode }[];
}) {
  return (
    <>
      <Table size="small">
        <TableHead><TableRow>{["#", ...cols.map((c) => c.label), ""].map((h, i) => <TableCell key={`${h}-${i}`} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {value.map((row, i) => (
            <TableRow key={i}>
              <TableCell sx={{ ...cell, color: MUTED }}>{i + 1}</TableCell>
              {cols.map((c, k) => <TableCell key={k} sx={{ ...cell, minWidth: c.width ?? 140 }}>{c.render(row, (patch) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</TableCell>)}
              <TableCell sx={cell}><RowTools i={i} n={value.length} onMove={(d) => onChange(move(value, i, d))} onDelete={() => onChange(value.filter((_, j) => j !== i))} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", mt: 1 }} onClick={() => onChange([...value, structuredClone(blank)])}>Add a row</Button>
    </>
  );
}

function PieceEditor({ s, piece, onSaved }: { s: State; piece: Piece; onSaved: () => void }) {
  const c = s.catalog;
  const original = piece.key ? (s.draft[piece.section] as Record<string, Field[]>)[piece.key] ?? [] : s.draft[piece.section];
  const [value, setValue] = useState<unknown>(structuredClone(original));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setValue(structuredClone(original)); setMsg(null); }, [piece.section, piece.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(value) !== JSON.stringify(original);
  const save = async (remove = false) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/smart-tickets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: piece.section, key: piece.key, value: remove ? null : value }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? { ok: true, text: remove ? "Removed from the draft." : "Saved in the draft - Publish to put it in the card." } : { ok: false, text: j.error ?? (r.status === 403 ? "Too large for one save, or admins only" : `HTTP ${r.status}`) });
      if (j.ok) onSaved();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(false); }
  };
  const d = s.draft;
  const props = c.properties;
  const enumOpts = (name: string) => props.find((p) => p.name === name)?.options ?? [];
  let editor: React.ReactNode;
  if (piece.section === "gqsForms" || piece.section === "pmForms") {
    editor = <FieldsEditor value={value as Field[]} props={props} gqs={piece.section === "gqsForms"} onChange={setValue} />;
  } else if (piece.section === "pipelines") {
    editor = <RowsEditor value={value as SmartForm["pipelines"]} onChange={setValue} blank={{ label: "", value: "", stage: "" }} cols={[
      { label: "Label", render: (r, set) => <TextField {...small} value={r.label} onChange={(e) => set({ label: e.target.value })} /> },
      { label: "HubSpot pipeline", width: 220, render: (r, set) => <TextField select {...small} value={r.value} onChange={(e) => set({ value: e.target.value, stage: "" })}>{c.pipelines.map((p) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}</TextField> },
      { label: "Stage a new sub-ticket starts in", width: 220, render: (r, set) => <TextField select {...small} value={r.stage} onChange={(e) => set({ stage: e.target.value })}>{(c.pipelines.find((p) => p.id === r.value)?.stages ?? []).map((st) => <MenuItem key={st.id} value={st.id}>{st.label}</MenuItem>)}</TextField> },
    ]} />;
  } else if (piece.section === "categories") {
    editor = <RowsEditor value={value as SmartForm["categories"]} onChange={setValue} blank={{ value: "", subField: "", textboxField: "", subOptions: [] }} cols={[
      { label: "Category", render: (r, set) => <TextField {...small} value={r.value} onChange={(e) => set({ value: e.target.value })} /> },
      { label: "Sub-category property", width: 240, render: (r, set) => <PropPicker props={props} value={r.subField} onChange={(v) => set({ subField: v })} /> },
      { label: "Sub-categories", width: 260, render: (r, set) => (
        <>
          <TextField {...small} multiline value={csv(r.subOptions)} onChange={(e) => set({ subOptions: uncsv(e.target.value) })} />
          {!!enumOpts(r.subField).length && <Button size="small" sx={{ textTransform: "none", p: 0, mt: 0.25 }} onClick={() => set({ subOptions: enumOpts(r.subField) })}>Use HubSpot&apos;s {enumOpts(r.subField).length}</Button>}
        </>
      ) },
      { label: "Text property", width: 240, render: (r, set) => <PropPicker props={props} value={r.textboxField} onChange={(v) => set({ textboxField: v })} /> },
    ]} />;
  } else if (piece.section === "quickActions") {
    editor = <RowsEditor value={value as SmartForm["quickActions"]} onChange={setValue} blank={{ label: "", pipelines: [], cat: "", sub: "", prefix: "" }} cols={[
      { label: "Button", render: (r, set) => <TextField {...small} value={r.label} onChange={(e) => set({ label: e.target.value })} /> },
      { label: "Pipelines", width: 220, render: (r, set) => <TextField select {...small} SelectProps={{ multiple: true }} value={r.pipelines} onChange={(e) => set({ pipelines: e.target.value as unknown as string[] })}>{d.pipelines.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}</TextField> },
      { label: "Category", width: 180, render: (r, set) => <TextField select {...small} value={r.cat} onChange={(e) => set({ cat: e.target.value, sub: "" })}>{d.categories.map((x) => <MenuItem key={x.value} value={x.value}>{x.value}</MenuItem>)}</TextField> },
      { label: "Sub-category", width: 220, render: (r, set) => <TextField select {...small} value={r.sub} onChange={(e) => set({ sub: e.target.value })}><MenuItem value="">-</MenuItem>{(d.categories.find((x) => x.value === r.cat)?.subOptions ?? []).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</TextField> },
      { label: "Subject starts with", render: (r, set) => <TextField {...small} value={r.prefix} onChange={(e) => set({ prefix: e.target.value })} /> },
    ]} />;
  } else if (piece.section === "gqsTypes") {
    const typeOpts = enumOpts("gqs_type_of_request");
    editor = <RowsEditor value={value as SmartForm["gqsTypes"]} onChange={setValue} blank={{ label: "", value: "", form: "__SHARED__" }} cols={[
      { label: "Shown as", render: (r, set) => <TextField {...small} value={r.label} onChange={(e) => set({ label: e.target.value })} /> },
      { label: "Value written (GQS type of request)", width: 240, render: (r, set) => typeOpts.length
        ? <TextField select {...small} value={r.value} onChange={(e) => set({ value: e.target.value })}>{typeOpts.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</TextField>
        : <TextField {...small} value={r.value} onChange={(e) => set({ value: e.target.value })} /> },
      { label: "Form", width: 200, render: (r, set) => <TextField select {...small} value={r.form} onChange={(e) => set({ form: e.target.value })}>{Object.keys(d.gqsForms).map((k) => <MenuItem key={k} value={k}>{formName(d, "gqsForms", k)}</MenuItem>)}</TextField> },
    ]} />;
  } else if (piece.section === "pmSubjects") {
    const pmOpts = enumOpts("sarcla_pm_choiceofrequest");
    editor = <RowsEditor value={value as SmartForm["pmSubjects"]} onChange={setValue} blank={{ label: "", value: "" }} cols={[
      { label: "Shown as", render: (r, set) => <TextField {...small} value={r.label} onChange={(e) => set({ label: e.target.value })} /> },
      { label: "Value written (PM choice of request)", width: 260, render: (r, set) => pmOpts.length
        ? <TextField select {...small} value={r.value} onChange={(e) => set({ value: e.target.value })}>{pmOpts.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}</TextField>
        : <TextField {...small} value={r.value} onChange={(e) => set({ value: e.target.value })} /> },
    ]} />;
  } else {
    editor = <RowsEditor value={value as SmartForm["sprLineManagers"]} onChange={setValue} blank={{ label: "", value: "" }} cols={[
      { label: "Line manager (HubSpot owner)", width: 300, render: (r, set) => <TextField select {...small} value={r.value} onChange={(e) => set({ value: e.target.value, label: c.owners.find((o) => o.id === e.target.value)?.name ?? "" })}>{c.owners.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}</TextField> },
    ]} />;
  }
  const canRemove = piece.key && piece.section === "gqsForms" && !d.gqsTypes.some((t) => t.form === piece.key);
  return (
    <GlassCard>
      <CardTitle icon={<EditNoteOutlinedIcon />} tint="blue" title={piece.label} note={piece.section === "gqsForms" ? "Margin % and Target price stay in every GQS form, required" : "Changes go to the draft first"} />
      <Box sx={{ overflowX: "auto" }}>{editor}</Box>
      {s.admin && (
        <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="small" variant="contained" disableElevation disabled={busy || !dirty} onClick={() => void save()} sx={{ borderRadius: "999px", textTransform: "none" }}>{busy ? <CircularProgress size={14} /> : "Save in the draft"}</Button>
          <Button size="small" disabled={busy || !dirty} onClick={() => setValue(structuredClone(original))} sx={{ textTransform: "none" }}>Undo my changes</Button>
          {canRemove && <Button size="small" color="error" disabled={busy} onClick={() => void save(true)} sx={{ textTransform: "none" }}>Remove this form</Button>}
          {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? INK : RED }}>{msg.text}</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}

const SECTION_LABEL: Record<string, string> = {
  pipelines: "Pipelines", categories: "Categories", quickActions: "Quick actions", gqsTypes: "GQS types",
  pmSubjects: "PM subjects", sprLineManagers: "SPR line managers",
};
function formName(d: SmartForm, section: "gqsForms" | "pmForms", key: string): string {
  if (section === "pmForms") return key;
  const users = d.gqsTypes.filter((t) => t.form === key).map((t) => t.label.replace(" - New Business", ""));
  return key === "__SHARED__" ? `Other profit centres${users.length ? ` (${users.join(", ")})` : ""}` : (users.length === 1 && users[0] === key ? key : `${key}${users.length ? ` (${users.join(", ")})` : ""}`);
}

export default function FormEditor() {
  const [n, setN] = useState(0);
  const held = useHeld<State>(`/api/uc/smart-tickets?form=1${n ? `&n=${n}` : ""}`, [n]);
  const r = held.result;
  const [pieceId, setPieceId] = useState("gqsForms:Running Business");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const s = r?.state === "ok" ? r.data : null;
  const pieces = useMemo<Piece[]>(() => {
    if (!s) return [];
    const d = s.draft;
    return [
      { section: "pipelines", key: null, label: "Pipelines" },
      { section: "categories", key: null, label: "Categories" },
      { section: "quickActions", key: null, label: "Quick actions" },
      { section: "gqsTypes", key: null, label: "GQS types" },
      ...Object.keys(d.gqsForms).map((k) => ({ section: "gqsForms" as Section, key: k, label: `GQS form - ${formName(d, "gqsForms", k)}` })),
      { section: "pmSubjects", key: null, label: "PM subjects" },
      ...d.pmSubjects.map((p) => ({ section: "pmForms" as Section, key: p.value, label: `PM form - ${p.label}` })),
      { section: "sprLineManagers", key: null, label: "SPR line managers" },
    ];
  }, [s]);
  if (r === null) return <LoadingPanel label="Reading the form's design…" />;
  if (r.state !== "ok" || !s) return <UpstreamPanel source="Create form" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  const piece = pieces.find((p) => `${p.section}:${p.key ?? ""}` === pieceId || `${p.section}:${p.key}` === pieceId) ?? pieces[0];
  const act = async (action: "publish" | "discard" | "built-in") => {
    setBusy(action); setMsg(null);
    try {
      const res = await fetch("/api/uc/smart-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { version?: number } };
      setMsg(j.ok ? { ok: true, text: action === "publish" ? `Published - version ${j.data?.version}. The card uses it the next time it opens.` : action === "discard" ? "Draft discarded." : "Draft set back to the built-in design - Publish to put it in the card." } : { ok: false, text: j.error ?? `HTTP ${res.status}` });
      setN((x) => x + 1);
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const newGqsForm = async () => {
    const name = window.prompt("Name of the new GQS form (pick it for a GQS type under GQS types)");
    if (!name?.trim() || s.draft.gqsForms[name.trim()]) return;
    await fetch("/api/uc/smart-tickets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "gqsForms", key: name.trim(), value: [
      { f: "customer_number_customer_name", l: "Customer # / Name", t: "text", autofill: "customer" },
      { f: "margin__", l: "Margin %", t: "number", req: true }, { f: "target_price", l: "Target price", t: "number", req: true },
    ] }) });
    setPieceId(`gqsForms:${name.trim()}`);
    setN((x) => x + 1);
  };
  return (
    <>
      <GlassCard>
        <CardTitle icon={<PublishOutlinedIcon />} tint="green" title="The card uses"
          note={s.live ? `Published version ${s.live.version}, ${when(s.live.at)}, by ${s.live.by}` : "The built-in design - nothing published yet"} />
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>
            {s.changed.length ? <>Draft: {s.changed.length} change{s.changed.length > 1 ? "s" : ""} not published - </> : "The draft is the same as what the card uses."}
            {s.changed.map((x) => <Chip key={x} tint="amber">{x.replace("gqsForms:", "GQS form ").replace("pmForms:", "PM form ").replace("__SHARED__", "Other profit centres")}</Chip>)}
          </Typography>
          {!!s.problems.length && (
            <Box sx={{ fontSize: "0.82rem", color: RED }}>
              {s.problems.slice(0, 12).map((p) => <div key={p}>• {p}</div>)}
              {s.problems.length > 12 && <div>… and {s.problems.length - 12} more</div>}
            </Box>
          )}
          {s.admin && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button size="small" variant="contained" disableElevation disabled={!!busy || !s.changed.length || !!s.problems.length} onClick={() => void act("publish")} sx={{ borderRadius: "999px", textTransform: "none" }}>
                {busy === "publish" ? <CircularProgress size={14} /> : "Publish to the card"}
              </Button>
              <Button size="small" disabled={!!busy || !s.changed.length} onClick={() => void act("discard")} sx={{ textTransform: "none" }}>Discard the draft</Button>
              <Button size="small" disabled={!!busy} onClick={() => void act("built-in")} sx={{ textTransform: "none" }}>Start again from the built-in design</Button>
              {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? INK : RED }}>{msg.text}</Typography>}
            </Box>
          )}
          {!!s.history.length && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Published: {s.history.map((h) => `v${h.version} ${when(h.at)}`).join(" · ")}</Typography>}
        </Box>
      </GlassCard>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "260px minmax(0, 1fr)" }, alignItems: "start" }}>
        <GlassCard sx={{ p: 1 }}>
          {pieces.map((p) => {
            const id = `${p.section}:${p.key ?? ""}`;
            const on = piece && `${piece.section}:${piece.key ?? ""}` === id;
            const changed = s.changed.includes(p.key ? `${p.section}:${p.key}` : p.section);
            return (
              <Box key={id} onClick={() => setPieceId(id)} sx={{ px: 1.25, py: 0.75, borderRadius: "10px", cursor: "pointer", fontSize: "0.84rem", fontWeight: on ? 700 : 500, color: INK, bgcolor: on ? "rgba(36,89,209,.10)" : "transparent", "&:hover": { bgcolor: "rgba(36,89,209,.06)" }, display: "flex", justifyContent: "space-between", gap: 1 }}>
                <span>{p.label}</span>{changed && <span style={{ color: "#a96a12" }}>●</span>}
              </Box>
            );
          })}
          {s.admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", m: 0.5 }} onClick={() => void newGqsForm()}>New GQS form</Button>}
        </GlassCard>
        {piece && <PieceEditor key={`${piece.section}:${piece.key ?? ""}:${n}`} s={s} piece={piece} onSaved={() => setN((x) => x + 1)} />}
      </Box>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{SECTION_LABEL.pipelines} and the rest are read from HubSpot when you open this tab; every property, pipeline, stage and owner is checked before Publish.</Typography>
    </>
  );
}
