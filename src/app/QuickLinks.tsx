"use client";
// QUICK LINKS — a column of mini apps beside the apps, yours, and editable where they are.
//
// SARCLA 13.11.2026: "put the quick actions on the left side in vertical like mini apps"; 14.11.2026: "put the column
// really next to apps so apps are still visible". So: a narrow column right against the app tiles, each link an icon
// square with its name under it, the column staying in view while the page scrolls. On a phone it is a strip across the
// top instead. No lift on hover - a moving tile is drawn on a layer of its own, and Windows drops ClearType there (the
// blurry text of 19.10.2026); the tile only brightens.
//
// The built-in ones can be switched off and you can add your own. Both are stored against your ACCOUNT, so what you set
// on the laptop is there on the desk machine; a per-browser list would be a bookmark with extra steps. Editing opens
// over the page, from the column's own Edit tile, because a preference you have to go looking for is one nobody sets.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import HubIcon from "@mui/icons-material/Hub";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import LinkIcon from "@mui/icons-material/Link";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#3b7df6";

type Built = { id: string; name: string; note: string; href: string; tint: string; fg: string; external: boolean; icon: React.ReactNode };

/**
 * Only destinations that exist. A dead tile on a front door is a bug. Each shows only to the people who may open it
 * (`mayOpen`): Pricing's two to the people with Pricing, Integrations and Audit to admins.
 */
const BUILT_IN: Built[] = [
  { id: "shop", name: "APSOparts", note: "The shop", href: "https://www.apsoparts.com", tint: "#efe8fd", fg: "#6a46c9", external: true, icon: <StorefrontOutlinedIcon /> },
  { id: "hubspot", name: "HubSpot", note: "The portal", href: "https://app-eu1.hubspot.com/contacts/26492587", tint: "#fde8f1", fg: "#b63a76", external: true, icon: <HubIcon /> },
  { id: "docs", name: "Docs", note: "How this works", href: "/docs", tint: "#e7f6ee", fg: "#1b7a55", external: false, icon: <MenuBookIcon /> },
  // Pricing's pages worked in most (the home-page mockup SARCLA approved on 14.11.2026)
  { id: "pricing-pending", name: "Pending review", note: "Pricing: matches waiting for approval", href: "/pricing/matches/pending", tint: "#fdf0e3", fg: "#a96a12", external: false, icon: <PendingActionsIcon /> },
  { id: "pricing-repricing", name: "Repricing", note: "Pricing: the Repricing studio", href: "/pricing/repricing", tint: "#fde9e6", fg: "#c8463a", external: false, icon: <PriceChangeOutlinedIcon /> },
  { id: "integrations", name: "Integrations", note: "What is connected", href: "/settings/integrations", tint: "#fdf0e3", fg: "#a96a12", external: false, icon: <SettingsIcon /> },
  { id: "audit", name: "Audit", note: "Who did what", href: "/settings/audit", tint: "#e6edfd", fg: "#3461c9", external: false, icon: <SecurityIcon /> },
];

type Custom = { label: string; href: string };

const isExternal = (href: string) => /^https?:/i.test(href);

/** One mini app: the icon square, its name under it. */
function Tile({ href, name, note, tint, fg, icon, external, rail }: {
  href: string; name: string; note: string; tint: string; fg: string; icon: React.ReactNode; external: boolean; rail: boolean;
}) {
  return (
    <Tooltip title={note} placement={rail ? "right" : "bottom"} disableInteractive>
      <Box
        component={external ? "a" : Link}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener" } : {})}
        sx={{
          display: "grid", justifyItems: "center", alignContent: "start", gap: 0.6,
          width: rail ? "100%" : 84, flexShrink: 0, py: 0.9, px: 0.5, borderRadius: "14px",
          textDecoration: "none", transition: "background-color .15s ease",
          "&:hover": { bgcolor: "rgba(255,255,255,.95)" },
          "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
        }}
      >
        <Box sx={{ width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", bgcolor: tint, color: fg, "& svg": { fontSize: 22 } }}>
          {icon}
        </Box>
        <Typography sx={{
          fontSize: "0.7rem", fontWeight: 600, color: INK, lineHeight: 1.2, textAlign: "center",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere",
        }}>{name}</Typography>
      </Box>
    </Tooltip>
  );
}

/**
 * `mayOpen` comes from the front page, which is the one place that knows this
 * person's role and grants. Without it a viewer was offered Integrations and
 * Audit here — two tiles that exist only to turn them away.
 */
export default function QuickLinks({ glass, mayOpen, variant = "rail" }: {
  glass: Record<string, unknown>;
  mayOpen?: (href: string) => boolean;
  /** rail: the column in the page's left margin, under the hub switch (page.tsx); strip: a row above the apps, where the
   *  window leaves no margin for the column (a laptop at a large zoom, a phone). */
  variant?: "rail" | "strip";
}) {
  const isRail = variant === "rail";
  const [hidden, setHidden] = useState<string[]>([]);
  const [custom, setCustom] = useState<Custom[]>([]);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setHidden(j.prefs?.hiddenQuickLinks ?? []);
        setCustom(j.prefs?.customQuickLinks ?? []);
      })
      .catch(() => { /* the built-in links stand on their own */ });
  }, []);

  const save = useCallback(async (next: { hidden: string[]; custom: Custom[] }) => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/me/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenQuickLinks: next.hidden, customQuickLinks: next.custom }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That could not be saved."); return false; }
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const toggle = async (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    setHidden(next);
    await save({ hidden: next, custom });
  };

  const add = async () => {
    const l = label.trim(), h = href.trim();
    if (!l || !h) { setError("A link needs a name and an address."); return; }
    if (custom.length >= 12) { setError("Twelve is the limit — remove one to add another."); return; }
    const next = [...custom, { label: l, href: h }];
    if (await save({ hidden, custom: next })) {
      setCustom(next); setLabel(""); setHref("");
    }
  };

  const remove = async (i: number) => {
    const next = custom.filter((_, k) => k !== i);
    setCustom(next);
    await save({ hidden, custom: next });
  };

  // Reachable first, then the ones they have not hidden. Editing lists every tile they could have — not every tile
  // that exists.
  const reachable = BUILT_IN.filter((b) => !mayOpen || mayOpen(b.href));
  const shown = reachable.filter((b) => !hidden.includes(b.id));

  return (
    <>
      <Box
        component="nav"
        aria-label="Quick links"
        sx={{
          ...glass, borderRadius: "22px", p: 0.75,
          display: "flex", flexDirection: isRail ? "column" : "row", alignItems: "stretch", gap: 0.25,
          width: "100%",
          // the rail stays in view while the page scrolls; the strip scrolls sideways when the links are many
          ...(isRail
            ? { position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }
            : { overflowX: "auto", overflowY: "hidden" }),
        }}
      >
        <Typography sx={{
          display: isRail ? "block" : "none", textAlign: "center", fontSize: "0.6rem", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT, pt: 0.75, pb: 0.25,
        }}>Quick links</Typography>

        {shown.map((b) => <Tile key={b.id} {...b} rail={isRail} />)}
        {custom.map((c, i) => (
          <Tile key={`${c.href}-${i}`} href={c.href} name={c.label} note={`Yours: ${c.href}`} tint="#e9eef5" fg="#4a5a70"
            icon={<LinkIcon />} external={isExternal(c.href)} rail={isRail} />
        ))}

        <Tooltip title="Choose your quick links" placement={isRail ? "right" : "bottom"} disableInteractive>
          <Box component="button" type="button" onClick={() => { setEditing(true); setError(null); }}
            sx={{
              display: "grid", justifyItems: "center", alignContent: "start", gap: 0.6, width: isRail ? "100%" : 84, flexShrink: 0,
              py: 0.9, px: 0.5, border: 0, borderRadius: "14px", background: "none", cursor: "pointer", fontFamily: "inherit",
              transition: "background-color .15s ease",
              "&:hover": { bgcolor: "rgba(255,255,255,.95)" },
              "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
            }}>
            <Box sx={{ width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", border: "1.5px dashed #c3cbd8", color: MUTED, "& svg": { fontSize: 20 } }}>
              <EditIcon />
            </Box>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: MUTED, lineHeight: 1.2 }}>Edit</Typography>
          </Box>
        </Tooltip>
      </Box>

      <Dialog open={editing} onClose={() => setEditing(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, pb: 0.5 }}>Quick links</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.5 }}>
            The column beside your apps. Switch a link off, or add your own (up to twelve).
          </Typography>
          {reachable.map((b) => (
            <Box key={b.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.5 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: b.tint, color: b.fg, "& svg": { fontSize: 17 } }}>{b.icon}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>{b.name}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: FAINT, lineHeight: 1.25 }}>{b.note}</Typography>
              </Box>
              <Switch size="small" checked={!hidden.includes(b.id)} onChange={() => toggle(b.id)} disabled={saving}
                inputProps={{ "aria-label": `Show ${b.name}` }} />
            </Box>
          ))}
          {custom.length > 0 && (
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT, mt: 2, mb: 0.5 }}>Yours</Typography>
          )}
          {custom.map((c, i) => (
            <Box key={`${c.href}-${i}`} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.5 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: "#e9eef5", color: "#4a5a70", "& svg": { fontSize: 17 } }}><LinkIcon /></Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>{c.label}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: FAINT, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.href}</Typography>
              </Box>
              <IconButton size="small" onClick={() => remove(i)} disabled={saving} aria-label={`Remove ${c.label}`}>
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid rgba(21,34,58,.08)", display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
            <TextField size="small" label="Name" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ width: 130 }} />
            <TextField size="small" label="Address" placeholder="https://… or /docs" value={href}
              onChange={(e) => setHref(e.target.value)} sx={{ flex: "1 1 160px", minWidth: 0 }} />
            <Button size="small" variant="contained" onClick={add} disabled={saving || custom.length >= 12} sx={{ textTransform: "none", mt: 0.25 }}>
              Add
            </Button>
            {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18", width: "100%" }}>{error}</Typography>}
          </Box>
        </DialogContent>
        <DialogActions>
          {saving && <Typography sx={{ fontSize: "0.74rem", color: FAINT, mr: "auto", pl: 2 }}>Saving…</Typography>}
          <Button onClick={() => setEditing(false)} sx={{ textTransform: "none" }}>Done</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
