"use client";
// THE CHANGES ON THE PAGE (08.11.2026): APSOconvert's change list, one line each in plain words (versions.describe),
// with what the preview found for it; each can be opened and edited, moved up or down, or removed. A change is checked
// by the same rules as APSOconvert's (validateChanges) before it is kept - no script, no handler, no frame.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { AMBER, GREEN, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { OP_LABEL, validateChanges, type Change, type Op } from "@/lib/convert/versions";
import { changeLine } from "@/lib/content/studio/kinds/page/model";
import type { ChangeHit } from "@/lib/content/studio/kinds/page/shop";
import { Field, btn, mainBtn } from "../../parts";
import { Chip, Choice, CodeField, Hint } from "./ui";

type Draft = { op: Op; selector: string; where: "before" | "after" | "prepend" | "append"; html: string; css: string; text: string; name: string; value: string; all: boolean; note: string };

const toDraft = (c: Change | null): Draft => {
  const x = (c ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof x[k] === "string" ? (x[k] as string) : "");
  return {
    op: (c?.op ?? "insert") as Op, selector: str("selector"), where: (["before", "after", "prepend", "append"].includes(str("where")) ? str("where") : "after") as Draft["where"],
    html: str("html"), css: str("css"), text: str("text"), name: str("name"), value: str("value"), all: x.all === true, note: str("note"),
  };
};

function fromDraft(d: Draft): unknown {
  const o: Record<string, unknown> = { op: d.op };
  if (d.note.trim()) o.note = d.note.trim();
  if (d.op === "css") { o.css = d.css; return o; }
  o.selector = d.selector.trim();
  if (d.all) o.all = true;
  if (d.op === "html" || d.op === "replace" || d.op === "insert") o.html = d.html;
  if (d.op === "insert") o.where = d.where;
  if (d.op === "text") o.text = d.text;
  if (d.op === "attr") { o.name = d.name.trim(); o.value = d.value; }
  return o;
}

const OPS: { key: Op; label: string }[] = (["insert", "html", "replace", "text", "css", "hide", "attr"] as Op[]).map((k) => ({ key: k, label: OP_LABEL[k] }));

function Editor({ open, change, onClose, onSave }: { open: boolean; change: Change | null; onClose: () => void; onSave: (c: Change) => void }) {
  const [d, setD] = useState<Draft>(toDraft(change));
  const [problems, setProblems] = useState<string[]>([]);
  useEffect(() => { if (open) { setD(toDraft(change)); setProblems([]); } }, [open, change]);
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const save = () => {
    const v = validateChanges([fromDraft(d)]);
    if (!v.changes.length) { setProblems(v.problems.map((p) => p.replace(/^change 1: /, ""))); return; }
    onSave(v.changes[0]);
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>{change ? "Edit the change" : "A new change"}</DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>
        <Box sx={{ mb: 2 }}><Choice value={d.op} onChange={(op) => up({ op })} options={OPS} /></Box>
        {d.op !== "css" && (
          <>
            <Field label="Which element (CSS selector)" value={d.selector} onChange={(v) => up({ selector: v })} placeholder="#maincontent .product-info-main" />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.25, flexWrap: "wrap" }}>
              {d.op === "insert" && <Choice value={d.where} onChange={(where) => up({ where })} options={[{ key: "before", label: "Before it" }, { key: "after", label: "After it" }, { key: "prepend", label: "At its start" }, { key: "append", label: "At its end" }]} />}
              <FormControlLabel control={<Checkbox size="small" checked={d.all} onChange={(e) => up({ all: e.target.checked })} />} label={<Typography sx={{ fontSize: "0.85rem" }}>Every element it finds</Typography>} />
            </Box>
          </>
        )}
        {(d.op === "html" || d.op === "replace" || d.op === "insert") && (
          <CodeField label={d.op === "html" ? "Its new content (HTML)" : d.op === "replace" ? "What takes its place (HTML)" : "The new block (HTML)"} value={d.html} onChange={(v) => up({ html: v })} rows={10}
            placeholder={`<div class="apx-block">\n  <h2>A short heading</h2>\n  <p><span class="apx-text">[Text from Content: what these words must do]</span></p>\n</div>`} />
        )}
        {d.op === "css" && <CodeField label="The stylesheet (CSS)" value={d.css} onChange={(v) => up({ css: v })} rows={10} placeholder=".apx-block { padding: 24px; }\n@media (max-width: 767px) { .apx-block { padding: 16px; } }" />}
        {d.op === "text" && <Field label="Its new text" value={d.text} onChange={(v) => up({ text: v })} multiline rows={3} max={2000} />}
        {d.op === "attr" && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 1 }}>
            <Field label="Attribute" value={d.name} onChange={(v) => up({ name: v })} placeholder="title" />
            <Field label="Its value" value={d.value} onChange={(v) => up({ value: v })} />
          </Box>
        )}
        <Field label="What it does, in a few words" value={d.note} onChange={(v) => up({ note: v })} max={300} placeholder="Delivery promise under the price" />
        <Hint>Long words go in as a placeholder Content writes: &lt;span class=&quot;apx-text&quot;&gt;[Text from Content: what they must do]&lt;/span&gt;. Class names you add start with apx-.</Hint>
        {problems.map((p) => <Typography key={p} sx={{ fontSize: "0.84rem", color: "#c5221f", mt: 1 }}>{p}</Typography>)}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={btn}>Cancel</Button>
        <Button variant="contained" disableElevation onClick={save} sx={mainBtn}>Keep it</Button>
      </DialogActions>
    </Dialog>
  );
}

const HIT: Record<string, { text: string; color: string }> = {
  found: { text: "On the page", color: GREEN },
  missing: { text: "Not found on the page", color: AMBER },
  unread: { text: "The preview cannot read this selector - the shop's test can", color: AMBER },
};

export function Changes({ changes, set, hits, canEdit }: { changes: Change[]; set: (next: Change[]) => void; hits: ChangeHit[] | null; canEdit: boolean }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const move = (i: number, to: number) => { const next = [...changes]; next.splice(to, 0, next.splice(i, 1)[0]); set(next); };
  const current = typeof editing === "number" ? changes[editing] ?? null : null;
  return (
    <Box>
      {changes.length === 0 && <Hint mt={0}>No change yet. Ask the assistant for one, or add it here.</Hint>}
      {changes.map((c, i) => {
        const h = hits?.find((x) => x.index === i);
        const state = h && h.state !== "css" ? HIT[h.state] : null;
        return (
          <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "flex-start", py: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, width: 18, pt: 0.25, flexShrink: 0, textAlign: "right" }}>{i + 1}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                <Chip tint={c.op === "css" ? "purple" : c.op === "hide" ? "slate" : "blue"}>{OP_LABEL[c.op] ?? c.op}</Chip>
                {state && <Typography sx={{ fontSize: "0.72rem", color: state.color, fontWeight: 600 }}>{state.text}{h && h.count > 1 ? ` · ${h.count}` : ""}</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.85rem", color: INK, mt: 0.4, wordBreak: "break-word" }}>{changeLine(c)}</Typography>
              {(c as { off?: string }).off && <Typography sx={{ fontSize: "0.74rem", color: "#c5221f", fontWeight: 600, mt: 0.25 }}>{(c as { off?: string }).off}</Typography>}
            </Box>
            {canEdit && (
              <Box sx={{ display: "flex", flexShrink: 0 }}>
                <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditing(i)}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Up"><span><IconButton size="small" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUpwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                <Tooltip title="Down"><span><IconButton size="small" disabled={i === changes.length - 1} onClick={() => move(i, i + 1)}><ArrowDownwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                <Tooltip title="Remove"><IconButton size="small" onClick={() => set(changes.filter((_, k) => k !== i))}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </Box>
            )}
          </Box>
        );
      })}
      {canEdit && <Button startIcon={<AddIcon />} onClick={() => setEditing("new")} sx={{ ...btn, mt: 1, color: INK }}>Add a change</Button>}
      <Editor open={editing !== null} change={current} onClose={() => setEditing(null)}
        onSave={(c) => {
          if (editing === "new") set([...changes, c]);
          // edited by hand: its id and module stay with it (Content v6)
          else if (typeof editing === "number") set(changes.map((x, k) => { const m = x as { id?: string; module?: unknown }; return k === editing ? ({ ...c, ...(m.id ? { id: m.id } : {}), ...(m.module ? { module: m.module } : {}) } as Change) : x; }));
          setEditing(null);
        }} />
    </Box>
  );
}
