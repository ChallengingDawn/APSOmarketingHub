"use client";
// PICK A PAGE OF THE SHOP (08.11.2026): the pages APSOconvert keeps indexed from the shop's sitemaps (production and ACC),
// searched by words, store view and kind - or an address typed in. Read through the studio's own action, so a person
// needs the project, not the Website area.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { KIND_LABEL, type Env, type PageKind } from "@/lib/convert/model";
import { pathInfo } from "@/lib/content/studio/kinds/page/model";
import { btn, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Chip, Choice, Hint } from "./ui";

type Row = { store: string; rest: string; kind: PageKind; product: string | null; name: string; prod: string | null; acc: string | null };
type Pages = { total: number; page: number; perPage: number; rows: Row[] };
export type Picked = { env: Env; path: string; store: string | null; kind: PageKind };

const KINDS: { key: "all" | PageKind; label: string }[] = [
  { key: "all", label: "All" }, { key: "cms", label: "CMS" }, { key: "category", label: "Category" }, { key: "product", label: "Product" }, { key: "home", label: "Home" },
];

/** A typed address as a path on the shop: a full address of production or ACC, or a path. */
function typedPath(raw: string): { env: Env | null; path: string } | null {
  let t = raw.trim();
  let env: Env | null = null;
  const m = /^https?:\/\/(www|acc)\.apsoparts\.com(\/.*)?$/i.exec(t);
  if (m) { env = m[1].toLowerCase() === "acc" ? "acc" : "prod"; t = m[2] ?? "/"; }
  t = t.split(/[?#]/)[0];
  return pathInfo(t) ? { env, path: t } : null;
}

export function PagePicker({ api, env, onEnv, onPick, onlyKind, store: storeIn }: {
  api: StudioApi; env: Env; onEnv: (e: Env) => void; onPick: (p: Picked) => void; onlyKind?: PageKind; store?: string;
}) {
  const [q, setQ] = useState("");
  const [store, setStore] = useState(storeIn ?? "");
  const [kind, setKind] = useState<"all" | PageKind>(onlyKind ?? "all");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<Pages | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stores, setStores] = useState<{ store: string; prod: number; acc: number }[]>([]);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    void api.act<{ stores: { store: string; prod: number; acc: number }[] }>("stores").then((r) => { if (r.ok) setStores(r.result.stores); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await api.act<Pages>("pages", { q, store: store || null, kind: kind === "all" ? null : kind, page });
      setBusy(false);
      if (r.ok) { setRes(r.result); setErr(null); } else setErr(r.error);
    }, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, store, kind, page]);

  const pick = (r: Row) => {
    const use: Env = r[env] ? env : r.prod ? "prod" : "acc";
    const path = r[use];
    if (!path) return;
    if (use !== env) onEnv(use);
    onPick({ env: use, path, store: r.store || null, kind: r.kind });
  };
  const typedOk = typedPath(typed);
  const from = res ? res.page * res.perPage + 1 : 0;
  const to = res ? Math.min(res.total, from + res.rows.length - 1) : 0;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, flex: 1 }}>Shown from</Typography>
        <Choice value={env} onChange={onEnv} options={[{ key: "prod", label: "Production" }, { key: "acc", label: "ACC" }]} />
      </Box>
      <TextField fullWidth size="small" placeholder="Search the shop's pages" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} sx={{ ...field, mb: 1 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: MUTED }} /></InputAdornment> } }} />
      <Box sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
        <TextField select size="small" value={store} onChange={(e) => { setStore(e.target.value); setPage(0); }} sx={{ ...field, minWidth: 130 }}
          slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Every store</MenuItem>
          {stores.map((s) => <MenuItem key={s.store} value={s.store}>{s.store}</MenuItem>)}
        </TextField>
        {!onlyKind && <Box sx={{ flex: 1, minWidth: 0 }}><Choice value={kind} onChange={(k) => { setKind(k); setPage(0); }} options={KINDS} /></Box>}
      </Box>

      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", bgcolor: "#fff", maxHeight: 320, overflowY: "auto" }}>
        {busy && !res && <Box sx={{ p: 2, color: MUTED, display: "flex", gap: 1, alignItems: "center", fontSize: "0.85rem" }}><CircularProgress size={14} /> Reading the index…</Box>}
        {err && <Typography sx={{ p: 1.5, fontSize: "0.84rem", color: "#c5221f" }}>{err}</Typography>}
        {res && res.rows.length === 0 && (
          <Typography sx={{ p: 1.5, fontSize: "0.84rem", color: MUTED }}>
            {q || store || kind !== "all" ? "No page matches." : "The shop's pages are not indexed here yet (AI testing & personalization reads them once a day). Type the address below."}
          </Typography>
        )}
        {res?.rows.map((r) => {
          const here = !!r[env];
          return (
            <Box key={`${r.store}/${r.rest}`} component="button" type="button" onClick={() => pick(r)} sx={{
              all: "unset", boxSizing: "border-box", display: "block", width: "100%", cursor: "pointer", px: 1.5, py: 1, borderBottom: `1px solid ${HAIRLINE}`,
              "&:hover": { bgcolor: "rgba(194,44,110,.05)" }, "&:focus-visible": { outline: "2px solid #c22c6e", outlineOffset: -2 },
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: r.kind === "home" ? "none" : "capitalize" }}>{r.name}</Typography>
                <Chip tint="slate">{KIND_LABEL[r.kind]}</Chip>
              </Box>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                /{r.store}/{r.rest}{!here ? ` · only on ${r.prod ? "production" : "ACC"}` : ""}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {res && res.total > res.perPage && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, flex: 1 }}>{from.toLocaleString("en-US")}-{to.toLocaleString("en-US")} of {res.total.toLocaleString("en-US")}</Typography>
          <Button size="small" disabled={page === 0 || busy} onClick={() => setPage((p) => p - 1)} sx={btn}>Previous</Button>
          <Button size="small" disabled={to >= res.total || busy} onClick={() => setPage((p) => p + 1)} sx={btn}>Next</Button>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 1, mt: 1.5, alignItems: "flex-start" }}>
        <TextField fullWidth size="small" placeholder="Or its address: /de-CH/…" value={typed} onChange={(e) => setTyped(e.target.value)} sx={field}
          onKeyDown={(e) => { if (e.key === "Enter" && typedOk) { const i = pathInfo(typedOk.path)!; if (typedOk.env) onEnv(typedOk.env); onPick({ env: typedOk.env ?? env, path: typedOk.path, store: i.store, kind: i.kind }); setTyped(""); } }} />
        <Button variant="outlined" disabled={!typedOk} sx={{ ...btn, borderColor: HAIRLINE, color: INK, flexShrink: 0 }}
          onClick={() => { if (!typedOk) return; const i = pathInfo(typedOk.path)!; if (typedOk.env) onEnv(typedOk.env); onPick({ env: typedOk.env ?? env, path: typedOk.path, store: i.store, kind: i.kind }); setTyped(""); }}>Use</Button>
      </Box>
      {typed && !typedOk && <Hint>A page of the shop: its address or path, without the cart, account or search.</Hint>}
    </Box>
  );
}
