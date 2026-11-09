"use client";
// THE HUB'S PICTURES, ALL IN ONE PLACE (08.11.2026; to the studios' flow standard 09.11.2026). Squared filters - whose
// (mine, everyone's, the logos) and what (made with AI, uploaded) - and a search; "Upload" and "Make one" at the top. A
// click shows the picture large: what it was made from, its size, who and when, WHERE IT IS USED (the to-dos you may
// open), and Copy its address / Download / Remove (your own pictures).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PictureDialog, type Picture } from "../studio/pictures";
import { PINK } from "../studio/parts";

type Whose = "mine" | "all" | "logos";
type Kind = "any" | "generated" | "upload";
type Use = { pieceId: number; projectId: number; title: string; project: string; contentType: string | null };

const KIND_WORD: Record<Picture["kind"], string> = { generated: "Made with AI", upload: "Uploaded", logo: "Logo" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const checker = {
  backgroundImage: "linear-gradient(45deg,#f3f5f8 25%,transparent 25%,transparent 75%,#f3f5f8 75%),linear-gradient(45deg,#f3f5f8 25%,transparent 25%,transparent 75%,#f3f5f8 75%)",
  backgroundSize: "14px 14px", backgroundPosition: "0 0, 7px 7px", bgcolor: "#fff",
};

/** One scope's pictures, newest first, 60 at a time. */
function useList(whose: Whose) {
  const [list, setList] = useState<Picture[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const read = useCallback(async (before?: number) => {
    const q = new URLSearchParams({ scope: whose, ...(before ? { before: String(before) } : {}) });
    const j = await fetch(`/api/content/assets?${q}`).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    if (!j.ok) { setError(j.error ?? "Not read."); if (!before) setList([]); return; }
    setError(null);
    setMore((j.assets ?? []).length >= 60);
    setList((cur) => (before ? [...(cur ?? []), ...j.assets] : j.assets));
  }, [whose]);
  useEffect(() => { setList(null); void read(); }, [read]);
  return { list, more, error, next: () => list?.length && read(list[list.length - 1].id), add: (p: Picture) => setList((c) => [p, ...(c ?? []).filter((x) => x.id !== p.id)]), drop: (id: number) => setList((c) => (c ?? []).filter((x) => x.id !== id)) };
}

function Tile({ p, onOpen }: { p: Picture; onOpen: () => void }) {
  return (
    <Box component="button" type="button" onClick={onOpen} sx={{
      all: "unset", cursor: "pointer", display: "block", borderRadius: "10px", overflow: "hidden", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxSizing: "border-box",
      transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: "0 10px 28px -14px rgba(16,24,40,.35)", transform: "translateY(-1px)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
    }}>
      <Box sx={{ aspectRatio: "1", ...(p.kind === "logo" ? checker : { bgcolor: "#eef1f6" }) }}>
        <Box component="img" src={p.url} alt={p.prompt ?? p.name ?? "picture"} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: p.kind === "logo" ? "contain" : "cover", p: p.kind === "logo" ? 2 : 0, boxSizing: "border-box", display: "block" }} />
      </Box>
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.prompt ?? p.name ?? KIND_WORD[p.kind]}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{KIND_WORD[p.kind]} · {day(p.at)}</Typography>
      </Box>
    </Box>
  );
}

const sideBtn = {
  all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.75, height: 36, px: 1.5, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, boxSizing: "border-box",
  fontSize: "0.84rem", fontWeight: 650, color: INK, bgcolor: "#fff", whiteSpace: "nowrap", "&:hover": { borderColor: "rgba(17,24,39,.3)" }, "& svg": { fontSize: 18 },
} as const;

function Large({ p, mine, onClose, onRemoved }: { p: Picture; mine: boolean; onClose: () => void; onRemoved: (id: number) => void }) {
  const [uses, setUses] = useState<Use[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUses(null);
    void fetch(`/api/content/assets?usage=${p.id}`).then((r) => r.json()).then((j) => { if (live) setUses(j.ok ? j.usage : []); }).catch(() => { if (live) setUses([]); });
    return () => { live = false; };
  }, [p.id]);
  const remove = async () => {
    if (!window.confirm(uses?.length ? `This picture is used in ${uses.length} to-do${uses.length > 1 ? "s" : ""}. Remove it anyway? It will not show there any more.` : "Remove this picture from the hub?")) return;
    const j = await fetch("/api/content/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id: p.id }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (j.ok) onRemoved(p.id); else setMsg(j.error ?? "Not removed.");
  };
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" }, minHeight: { md: 520 } }}>
      <Box sx={{ display: "grid", placeItems: "center", p: 2, ...(p.kind === "logo" ? checker : { bgcolor: "#eef1f6" }) }}>
        <Box component="img" src={p.url} alt={p.prompt ?? p.name ?? "picture"} sx={{ maxWidth: "100%", maxHeight: "72vh", objectFit: "contain", borderRadius: "6px", display: "block" }} />
      </Box>
      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2, borderLeft: { md: `1px solid ${HAIRLINE}` }, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED }}>{KIND_WORD[p.kind]}</Typography>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK, mt: 0.5, lineHeight: 1.4, overflowWrap: "anywhere" }}>{p.prompt ?? p.name ?? "No description"}</Typography>
          </Box>
          <IconButton size="small" aria-label="Close" onClick={onClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.6 }}>
          {p.width ? `${p.width} × ${p.height} px · ` : ""}{day(p.at)}{p.by ? ` · ${p.by.split("@")[0]}` : ""}
        </Typography>
        <Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Where it is used</Typography>
          {!uses && <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.82rem" }}><CircularProgress size={14} sx={{ color: MUTED }} />Looking through the to-dos…</Box>}
          {uses && !uses.length && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>In no to-do yet.</Typography>}
          {uses?.map((u) => (
            <Box key={u.pieceId} component={Link} href={`/projects/${u.projectId}/pieces/${u.pieceId}`} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderTop: `1px solid ${HAIRLINE}`, textDecoration: "none", color: INK, "&:hover .t": { color: PINK } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography className="t" sx={{ fontSize: "0.84rem", fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.title}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.project}</Typography>
              </Box>
              <OpenInNewIcon sx={{ fontSize: 15, color: MUTED }} />
            </Box>
          ))}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Box component="button" type="button" sx={sideBtn} onClick={async () => { await navigator.clipboard.writeText(new URL(p.url, window.location.origin).toString()).catch(() => undefined); setCopied(true); }}>
            <ContentCopyIcon />{copied ? "Address copied" : "Copy its address"}
          </Box>
          <Box component="a" href={p.url} download sx={sideBtn}><FileDownloadOutlinedIcon />Download</Box>
          {mine && <Box component="button" type="button" onClick={() => void remove()} sx={{ ...sideBtn, color: "#b42318" }}><DeleteOutlineIcon />Remove</Box>}
        </Box>
        {msg && <Typography sx={{ fontSize: "0.8rem", color: "#b42318" }}>{msg}</Typography>}
      </Box>
    </Box>
  );
}

export default function Gallery() {
  const [whose, setWhose] = useState<Whose>("mine");
  const [kind, setKind] = useState<Kind>("any");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Picture | null>(null);
  const [adding, setAdding] = useState<"make" | "upload" | null>(null);
  const list = useList(whose);
  // which pictures are mine (Remove is offered on those) - from the "mine" list, whatever is shown
  const mineList = useList("mine");
  const mineIds = useMemo(() => new Set((mineList.list ?? []).map((p) => p.id)), [mineList.list]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (list.list ?? []).filter((p) => (whose === "logos" || kind === "any" || p.kind === kind) && (!words || `${p.prompt ?? ""} ${p.name ?? ""}`.toLowerCase().includes(words)));
  }, [list.list, kind, q, whose]);

  return (
    <GlassCard>
      {/* the filters, the search, the two ways to add one */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mb: 2 }}>
        <SquareChoice value={whose} onChange={(v) => setWhose(v)} options={[{ key: "mine", label: "Mine" }, { key: "all", label: "Everyone's" }, { key: "logos", label: "Logos" }]} />
        {whose !== "logos" && <SquareChoice value={kind} onChange={setKind} options={[{ key: "any", label: "All" }, { key: "generated", label: "Made with AI" }, { key: "upload", label: "Uploaded" }]} />}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 32, px: 1.25, borderRadius: "6px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)", minWidth: 170, flex: "0 1 240px" }}>
          <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search what it shows" sx={{ fontSize: "0.84rem", flex: 1 }} inputProps={{ "aria-label": "Search the pictures" }} />
        </Box>
        {/* the count and the two ways to add one stay together, on the right */}
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.25 }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{list.list ? `${shown.length}${list.more ? "+" : ""} picture${shown.length === 1 ? "" : "s"}` : ""}</Typography>
          <Box component="button" type="button" onClick={() => setAdding("upload")} sx={sideBtn}><FileUploadOutlinedIcon />Upload</Box>
          <Box component="button" type="button" onClick={() => setAdding("make")} sx={{ ...sideBtn, border: 0, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } }}><AutoAwesomeOutlinedIcon />Make one</Box>
        </Box>
      </Box>

      {!list.list && <Box sx={{ py: 6, display: "grid", placeItems: "center" }}><CircularProgress size={22} /></Box>}
      {list.error && <Typography sx={{ fontSize: "0.84rem", color: "#b42318", mb: 1 }}>{list.error}</Typography>}
      {list.list && !shown.length && (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK }}>{q ? "No picture shows that." : whose === "mine" ? "You have made or uploaded no picture yet." : "No pictures here yet."}</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.5 }}>Make one from a few words, or upload one - it is then ready in every studio.</Typography>
        </Box>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1.5 }}>
        {shown.map((p) => <Tile key={p.id} p={p} onOpen={() => setOpen(p)} />)}
      </Box>
      {list.more && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Box component="button" type="button" onClick={() => void list.next()} sx={sideBtn}>Show older pictures</Box>
        </Box>
      )}

      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: "14px", overflow: "hidden" } } }}>
        {open && <Large p={open} mine={mineIds.has(open.id)} onClose={() => setOpen(null)} onRemoved={(id) => { list.drop(id); mineList.drop(id); setOpen(null); }} />}
      </Dialog>
      <PictureDialog open={!!adding} onClose={() => setAdding(null)} title={adding === "make" ? "Make a picture" : "Upload a picture"}
        tabs={adding === "make" ? ["make"] : ["upload"]} start={adding ?? "make"}
        onPick={(p) => { setAdding(null); mineList.add(p); if (whose !== "logos") list.add(p); setOpen(p); }} />
    </GlassCard>
  );
}
