"use client";
// SAVED VIEWS (SARCLA 18.10.2026: "save a set of filters to use as custom views") - beside a page's
// Filters button: the page's filters as they are now (its address' query) kept under a name, mine
// unless shared. Picking one puts its filters back.

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { refreshActions, send, useActions } from "./store";

/** The query a view keeps: the page's own parameters, sorted, so the same filters are the same view. */
export const viewQuery = (sp: URLSearchParams) => [...sp.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

export function SavedViews({ page }: { page: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const { state } = useActions(page);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const now = viewQuery(new URLSearchParams(sp.toString()));
  const views = state?.views ?? [];
  const current = views.find((v) => v.query === now);

  const apply = (q: string) => { router.replace(q ? `${path}?${q}` : path, { scroll: false }); setAnchor(null); };
  const save = async () => {
    if (!name.trim()) return;
    try { await send("/api/reporting/kpi-actions/views", "POST", { page, name, query: now, shared }); setName(""); setShared(false); setErr(null); await refreshActions(page); }
    catch (e) { setErr((e as Error).message); }
  };
  const share = async (id: number, to: boolean) => {
    try { await send("/api/reporting/kpi-actions/views", "PATCH", { id, shared: to }); await refreshActions(page); } catch (e) { setErr((e as Error).message); }
  };
  const remove = async (id: number) => {
    if (!confirm("Remove this view?")) return;
    try { await send(`/api/reporting/kpi-actions/views?id=${id}`, "DELETE"); await refreshActions(page); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <Button variant="outlined" onClick={(e) => setAnchor(e.currentTarget)} startIcon={<BookmarksOutlinedIcon sx={{ fontSize: 18 }} />}
        sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", borderColor: HAIRLINE, color: current ? TINT.blue.fg : INK, bgcolor: "#fff" }}>
        {current ? current.name : "Views"}
      </Button>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 340, borderRadius: "16px", p: 1.5, mt: 0.75 } } }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.75 }}>Saved views</Typography>
        {!views.length && <Typography sx={{ fontSize: "0.82rem", color: FAINT, mb: 1 }}>None yet - set the filters, then save them here.</Typography>}
        <Box sx={{ display: "grid", gap: 0.25, mb: 1 }}>
          {views.map((v) => (
            <Box key={v.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, borderRadius: "10px", px: 0.75, bgcolor: v.query === now ? TINT.blue.bg : "transparent", "&:hover": { bgcolor: v.query === now ? TINT.blue.bg : "rgba(21,34,58,.04)" } }}>
              <Box component="button" type="button" onClick={() => apply(v.query)} sx={{ flex: 1, minWidth: 0, textAlign: "left", border: 0, bgcolor: "transparent", font: "inherit", cursor: "pointer", py: 0.75 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 650, color: INK }}>{v.name}</Typography>
                <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{v.mine ? (v.shared ? "mine · shared with everyone" : "mine") : `shared by ${v.ownerName}`}</Typography>
              </Box>
              {v.mine && (
                <>
                  <IconButton size="small" aria-label={v.shared ? "Stop sharing" : "Share with everyone"} onClick={() => void share(v.id, !v.shared)} sx={{ color: v.shared ? TINT.blue.fg : FAINT }}><PeopleOutlineIcon sx={{ fontSize: 18 }} /></IconButton>
                  <IconButton size="small" aria-label="Remove the view" onClick={() => void remove(v.id)}><DeleteOutlineIcon sx={{ fontSize: 18, color: FAINT }} /></IconButton>
                </>
              )}
            </Box>
          ))}
        </Box>
        {state?.canWrite && !current && (
          <Box sx={{ display: "grid", gap: 0.75, pt: 1, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Save the filters as they are now</Typography>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              <TextField size="small" placeholder="Name, e.g. Germany last quarter" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
                sx={{ flex: 1, "& .MuiInputBase-root": { fontSize: "0.84rem", borderRadius: "10px" } }} />
              <Button variant="contained" disableElevation disabled={!name.trim()} onClick={() => void save()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Save</Button>
            </Box>
            <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}>
              <Switch size="small" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Share with everyone</Typography>
            </Box>
          </Box>
        )}
        {err && <Typography sx={{ fontSize: "0.8rem", color: RED, mt: 0.5 }}>{err}</Typography>}
      </Popover>
    </>
  );
}
