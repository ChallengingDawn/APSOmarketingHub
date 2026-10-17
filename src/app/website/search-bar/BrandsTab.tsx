"use client";

// Search bar > Brands: the brand names the bar recognises in a search, with the material and maker each stands
// for (the dashboard's "Brand names"), and new ones added here (SARCLA 17.10.2026: "on brands allow to add
// brands"). An added brand stands for one material: a search for it shows that material's products, as for a
// built-in brand - the shop learns it within about a minute. Admins add and remove; the built-in ones stay.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { Brand, BrandMaterial, Brands } from "@/lib/searchbar/gateway";
import { Empty, Loaded, pill, post, when } from "./shared";

type Data = Brands & { isAdmin: boolean };
type Show = "all" | "added";

function AddBrand({ materials, onAdded }: { materials: BrandMaterial[]; onAdded: (name: string) => void }) {
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    const r = await post({ action: "brand-add", brand, material, vendor, notes });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Did not work."); return; }
    const name = brand.trim();
    setBrand(""); setMaterial(""); setVendor(""); setNotes("");
    onAdded(name);
  };
  return (
    <GlassCard>
      <CardTitle icon={<AddCircleOutlineIcon />} tint="green" title="Add a brand"
        note="A trade name customers type, and the material it is: a search for it then shows that material's products" />
      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!busy) void submit(); }}
        sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
        <TextField size="small" label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} required sx={{ flex: "1 1 180px" }} inputProps={{ maxLength: 40, spellCheck: false }} />
        <TextField size="small" select label="Material" value={material} onChange={(e) => setMaterial(e.target.value)} required sx={{ flex: "0 1 190px" }}>
          {materials.map((m) => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Maker (optional)" value={vendor} onChange={(e) => setVendor(e.target.value)} sx={{ flex: "1 1 160px" }} inputProps={{ maxLength: 60 }} />
        <TextField size="small" label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ flex: "2 1 220px" }} inputProps={{ maxLength: 200 }} />
        <Button type="submit" variant="contained" disableElevation disabled={busy || !brand.trim() || !material} sx={{ ...pill, height: 40 }}>
          {busy ? <CircularProgress size={16} color="inherit" /> : "Add"}
        </Button>
      </Box>
      {err && <Box sx={{ mt: 1.25 }}><Notice tone="bad">{err}</Notice></Box>}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 1 }}>
        Not accepted: a name the bar already knows (a brand or a material), a word customers search with (plate, hose, seal …), digits only.
      </Typography>
    </GlassCard>
  );
}

function Rows({ brands, isAdmin, reload, onMsg }: { brands: Brand[]; isAdmin: boolean; reload: () => void; onMsg: (m: { ok: boolean; text: string }) => void }) {
  const [find, setFind] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const f = find.trim().toLowerCase();
  const pool = show === "added" ? brands.filter((b) => b.added) : brands;
  const rows = f ? pool.filter((b) => [b.brand, b.material, b.vendor, b.notes].join(" ").toLowerCase().includes(f)) : pool;
  const { slice, pager } = usePaged(rows, 20);
  const added = brands.filter((b) => b.added).length;
  const remove = async (b: Brand) => {
    if (!confirm(`Remove "${b.brand}"? A search for it then no longer shows ${b.material}.`)) return;
    setBusy(b.brand);
    const r = await post({ action: "brand-remove", brand: b.brand });
    setBusy(null);
    onMsg(r.ok ? { ok: true, text: `"${b.brand}" removed.` } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <>
      <Box sx={{ px: { xs: 2, md: 2.75 }, mb: 1.5, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" placeholder="Find a brand, material or maker…" value={find} onChange={(e) => setFind(e.target.value)} sx={{ width: 300 }} />
        <Choice<Show> value={show} onChange={setShow} options={[{ key: "all", label: "All", count: brands.length }, { key: "added", label: "Added here", count: added }]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead><TableRow>{["Brand", "Material", "Maker", "Note", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} sx={bodyCell}><Empty>{show === "added" && !f ? "No brand added yet." : "No brand matches."}</Empty></TableCell></TableRow>}
            {slice.map((b) => (
              <TableRow key={`${b.brand}|${b.added ? 1 : 0}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                    {b.brand}
                    {b.added && <Tooltip title={`Added${b.added_by ? ` by ${b.added_by}` : ""}${b.added_at ? ` on ${when(b.added_at)}` : ""}`}><span><Chip tint="green">added</Chip></span></Tooltip>}
                  </Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{b.material}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{b.vendor}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{b.notes}</TableCell>
                <TableCell sx={{ ...bodyCell, width: 44, textAlign: "right" }}>
                  {b.added && isAdmin && (
                    <Tooltip title="Remove this brand">
                      <span><IconButton size="small" disabled={busy !== null} onClick={() => void remove(b)} aria-label={`Remove ${b.brand}`}>
                        {busy === b.brand ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 18 }} />}
                      </IconButton></span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function BrandsTab() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Loaded<Data> url="/api/website/search-bar?part=brands" what="the brands">
      {(d, reload) => (
        <>
          {d.isAdmin && (d.materials?.length ?? 0) > 0 && (
            <AddBrand materials={d.materials ?? []} onAdded={(name) => { setMsg({ ok: true, text: `"${name}" added - the shop's search bar knows it within about a minute.` }); reload(); }} />
          )}
          {msg && (msg.ok ? <Typography sx={{ fontSize: "0.84rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
          <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
            <Box sx={{ px: { xs: 2, md: 2.75 } }}>
              <CardTitle icon={<LocalOfferOutlinedIcon />} tint="amber" title="Brand names the bar recognises"
                note={`${full(d.total)} brands - a search for one shows that brand's products and material${d.isAdmin ? "" : " · only an admin can add or remove"}`} />
            </Box>
            <Rows brands={d.brands ?? []} isAdmin={d.isAdmin} reload={reload} onMsg={setMsg} />
          </GlassCard>
        </>
      )}
    </Loaded>
  );
}
