"use client";

// Search bar > Featured: the products the bar features when it opens (the dashboard's "Features today"), with
// their texts in the shop's six languages - and their editor, moved here from the old dashboard (SARCLA
// 17.10.2026) so its search-bar pages can go. Admins add, edit, hide, delete, or go back to the original six.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { Feature, FeatureText } from "@/lib/searchbar/gateway";
import { Empty, Loaded, pill, post } from "./shared";

const LANGS = [
  { key: "en", label: "English" }, { key: "de", label: "Deutsch" }, { key: "fr", label: "Français" },
  { key: "it", label: "Italiano" }, { key: "nl", label: "Nederlands" }, { key: "pl", label: "Polski" },
] as const;
type Lang = (typeof LANGS)[number]["key"];
type Data = { features: Feature[]; isAdmin: boolean };
const BLANK_TEXT: FeatureText = { tag: "", material: "", temp: "", use: "" };
const blank = (order: number): Feature => ({ id: "", sku: "", title: "", code: "", hf: "", tag: "", spec: "", photo_url: "", link_url: "", copy: "", i18n: {}, active: true, sort_order: order, alternates: [] });

function Card({ f, onEdit }: { f: Feature; onEdit?: () => void }) {
  const en = f.i18n?.en;
  const langs = Object.keys(f.i18n ?? {});
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, display: "flex", gap: 1.5, height: "100%", bgcolor: "rgba(255,255,255,.6)", opacity: f.active === false ? 0.55 : 1 }}>
      {f.photo_url && <Box component="img" src={f.photo_url} alt="" loading="lazy" onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = "hidden"; }} sx={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0, borderRadius: "10px", bgcolor: "#fff" }} />}
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.4, alignContent: "start", flex: 1 }}>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{f.title}</Typography>
          {onEdit && <Button size="small" startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />} onClick={onEdit} sx={{ ...pill, minWidth: 0, py: 0, flexShrink: 0 }}>Edit</Button>}
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{f.sku} · {f.hf}{f.code ? ` · ${f.code}` : ""}</Typography>
        {f.active === false && <Box><Chip tint="slate">hidden from customers</Chip></Box>}
        {(en?.tag || f.tag) && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, letterSpacing: "0.04em" }}>{en?.tag || f.tag}</Typography>}
        {(en?.use || f.copy) && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{en?.use || f.copy}</Typography>}
        {langs.length > 0 && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>{langs.map((l) => <Chip key={l} tint="slate">{l}</Chip>)}</Box>}
      </Box>
    </Box>
  );
}

/** Six cards a page. */
function Cards({ features, onEdit }: { features: Feature[]; onEdit?: (f: Feature) => void }) {
  const { slice, pager } = usePaged(features, 6);
  return (
    <>
      <Grid container spacing={1.5}>
        {slice.map((f) => <Grid key={f.id} size={{ xs: 12, md: 6, xl: 4 }}><Card f={f} onEdit={onEdit ? () => onEdit(f) : undefined} /></Grid>)}
      </Grid>
      {pager && <Box sx={{ mt: 1.5 }}>{pager}</Box>}
    </>
  );
}

function Editor({ start, onDone, onCancel }: { start: Feature; onDone: (text: string) => void; onCancel: () => void }) {
  const [f, setF] = useState<Feature>({ ...start, i18n: { ...(start.i18n ?? {}) } });
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const text: FeatureText = { ...BLANK_TEXT, ...(f.i18n?.[lang] ?? {}) };
  const set = (k: keyof Feature) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const setText = (k: keyof FeatureText) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, i18n: { ...(f.i18n ?? {}), [lang]: { ...text, [k]: e.target.value } } });
  const filled = (l: string) => { const t = f.i18n?.[l]; return !!t && Object.values(t).some((v) => String(v ?? "").trim()); };
  const save = async () => {
    setBusy("save"); setErr(null);
    const r = await post({ action: "feature-save", feature: f });
    setBusy(null);
    if (r.ok) onDone(f.id ? `"${f.title}" saved - the shop shows it on the next page opened.` : `"${f.title}" added.`);
    else setErr(r.error ?? "Did not work.");
  };
  const remove = async () => {
    if (!confirm(`Delete "${f.title}" from the featured products? To keep it but stop showing it, switch "Shown to customers" off instead.`)) return;
    setBusy("delete"); setErr(null);
    const r = await post({ action: "feature-delete", id: f.id });
    setBusy(null);
    if (r.ok) onDone(`"${f.title}" deleted.`);
    else setErr(r.error ?? "Did not work.");
  };
  return (
    <GlassCard>
      <CardTitle icon={<EditOutlinedIcon />} tint="blue" title={f.id ? `Edit "${start.title}"` : "Add a featured product"}
        note="The same for every language: name, article, picture, link. Per language: the four lines of the card." />
      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!busy) void save(); }} sx={{ display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <TextField size="small" label="Product name" value={f.title} onChange={set("title")} required sx={{ flex: "2 1 220px" }} />
          <TextField size="small" label="Article or product number" value={f.sku} onChange={set("sku")} required sx={{ flex: "1 1 180px" }} helperText="The card links to it" />
          <TextField size="small" label="Material code (e.g. EPDM)" value={f.code} onChange={set("code")} sx={{ flex: "1 1 150px" }} />
          <TextField size="small" label="Type (e.g. O-ring)" value={f.hf} onChange={set("hf")} sx={{ flex: "1 1 150px" }} />
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField size="small" label="Picture address (https://www.apsoparts.com/media/…)" value={f.photo_url} onChange={set("photo_url")} sx={{ flex: "3 1 320px" }} />
          <TextField size="small" label="Other link (optional)" value={f.link_url} onChange={set("link_url")} sx={{ flex: "2 1 220px" }} helperText="Only when the number should not decide the page" />
          {f.photo_url && <Box component="img" src={f.photo_url} alt="" sx={{ width: 56, height: 56, objectFit: "contain", borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }} />}
        </Box>
        <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: "12px", border: `1px solid ${HAIRLINE}` }}>
          <Choice<Lang> value={lang} onChange={setLang} options={LANGS.map((l) => ({ key: l.key, label: `${l.label}${filled(l.key) ? "" : " · empty"}` }))} />
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField size="small" label="Tag line (red, upper case)" value={text.tag} onChange={setText("tag")} sx={{ flex: "1 1 220px" }} inputProps={{ maxLength: 120 }} />
            <TextField size="small" label="Material, full name" value={text.material} onChange={setText("material")} sx={{ flex: "1 1 220px" }} inputProps={{ maxLength: 200 }} />
            <TextField size="small" label="Temperature range" value={text.temp} onChange={setText("temp")} sx={{ flex: "0 1 180px" }} inputProps={{ maxLength: 80 }} />
          </Box>
          <TextField size="small" label="Typical use" value={text.use} onChange={setText("use")} multiline minRows={2} inputProps={{ maxLength: 300 }} />
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>An empty language shows the English lines.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" type="number" label="Order" value={f.sort_order ?? 0} onChange={(e) => setF({ ...f, sort_order: parseInt(e.target.value, 10) || 0 })} sx={{ width: 110 }} />
          <FormControlLabel control={<Switch checked={f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} slotProps={{ input: { "aria-label": "Shown to customers" } }} />}
            label={<Typography sx={{ fontSize: "0.86rem" }}>Shown to customers</Typography>} />
          <Box sx={{ flex: 1 }} />
          {f.id && <Button color="error" variant="outlined" sx={pill} disabled={busy !== null} onClick={() => void remove()}>{busy === "delete" ? <CircularProgress size={16} /> : "Delete"}</Button>}
          <Button variant="outlined" sx={pill} disabled={busy !== null} onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="contained" disableElevation sx={pill} disabled={busy !== null || !f.title.trim() || !f.sku.trim()}>{busy === "save" ? <CircularProgress size={16} color="inherit" /> : f.id ? "Save" : "Add"}</Button>
        </Box>
        {err && <Notice tone="bad">{err}</Notice>}
      </Box>
    </GlassCard>
  );
}

function Featured({ d, reload }: { d: Data; reload: () => void }) {
  const [editing, setEditing] = useState<Feature | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const features = d.features ?? [];
  const shown = features.filter((f) => f.active !== false).length;
  const reset = async () => {
    if (!confirm("Go back to the original six featured products, with their texts in every language? Every change made here is lost.")) return;
    setBusy(true);
    const r = await post({ action: "feature-reset" });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Back to the original six." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <>
      {editing && <Editor key={editing.id || "new"} start={editing} onCancel={() => setEditing(null)} onDone={(text) => { setEditing(null); setMsg({ ok: true, text }); reload(); }} />}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.84rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
      <GlassCard>
        <CardTitle icon={<StarOutlineIcon />} tint="amber" title="Featured when the bar opens"
          note={`${shown} shown to customers${features.length > shown ? `, ${features.length - shown} hidden` : ""} · each with its lines in the shop's languages${d.isAdmin ? "" : " · only an admin can change them"}`}
          right={d.isAdmin ? (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void reset()}>{busy ? <CircularProgress size={14} /> : "Back to the original six"}</Button>
              <Button size="small" variant="contained" disableElevation sx={pill} onClick={() => { setMsg(null); setEditing(blank(features.length)); }}>Add</Button>
            </Box>
          ) : undefined} />
        {!features.length ? <Empty>No featured product.</Empty> : <Cards features={features} onEdit={d.isAdmin ? (f) => { setMsg(null); setEditing(f); } : undefined} />}
      </GlassCard>
    </>
  );
}

export default function FeaturesTab() {
  return (
    <Loaded<Data> url="/api/website/search-bar?part=features" what="the featured products">
      {(d, reload) => <Featured d={d} reload={reload} />}
    </Loaded>
  );
}
