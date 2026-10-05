"use client";
// QUICK LINKS — yours, and editable where they are.
//
// The built-in ones can be switched off and you can add your own. Both are
// stored against your ACCOUNT, so what you set on the laptop is there on the
// desk machine; a per-browser list would be a bookmark with extra steps.
//
// Editing happens here rather than three clicks away in a settings screen,
// because a preference you have to go looking for is one nobody sets.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import LinkIcon from "@mui/icons-material/Link";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#3b7df6";

type Built = { id: string; name: string; note: string; href: string; tint: string; fg: string; external: boolean };

/** Only destinations that exist. A dead tile on a front door is a bug. */
const BUILT_IN: Built[] = [
  { id: "shop", name: "APSOparts", note: "The shop", href: "https://www.apsoparts.com", tint: "#efe8fd", fg: "#6a46c9", external: true },
  { id: "hubspot", name: "HubSpot", note: "The portal", href: "https://app-eu1.hubspot.com/contacts/26492587", tint: "#fde8f1", fg: "#b63a76", external: true },
  { id: "docs", name: "Docs", note: "How this works", href: "/docs", tint: "#e7f6ee", fg: "#1b7a55", external: false },
  { id: "integrations", name: "Integrations", note: "What is connected", href: "/settings/integrations", tint: "#fdf0e3", fg: "#a96a12", external: false },
  { id: "audit", name: "Audit", note: "Who did what", href: "/settings/audit", tint: "#e6edfd", fg: "#3461c9", external: false },
];

const glyph = (b: Built) =>
  b.external ? <OpenInNewIcon /> : b.id === "docs" ? <MenuBookIcon /> : b.id === "audit" ? <SecurityIcon /> : <SettingsIcon />;

type Custom = { label: string; href: string };

/**
 * `mayOpen` comes from the front page, which is the one place that knows this
 * person's role and grants. Without it a viewer was offered Integrations and
 * Audit here — two tiles that exist only to turn them away.
 */
export default function QuickLinks({ glass, mayOpen }: {
  glass: Record<string, unknown>;
  mayOpen?: (href: string) => boolean;
}) {
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

  const tile = {
    width: 92, p: 1.5, borderRadius: "16px", textDecoration: "none", textAlign: "center" as const,
    bgcolor: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.85)",
    display: "grid", justifyItems: "center", gap: 0.75, position: "relative" as const,
    transition: "transform .18s ease, background-color .18s ease",
    "&:hover": { transform: "translateY(-3px)", bgcolor: "#fff" },
    "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 3 },
  };

  // Reachable first, then the ones they have not hidden. Editing shows every
  // tile they could have — not every tile that exists.
  const reachable = BUILT_IN.filter((b) => !mayOpen || mayOpen(b.href));
  const shown = reachable.filter((b) => !hidden.includes(b.id));

  return (
    <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.25 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.75 }}>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", flex: 1 }}>
          Quick links
        </Typography>
        {saving && <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Saving…</Typography>}
        <Button size="small" startIcon={editing ? <CheckIcon /> : <EditIcon />}
          onClick={() => { setEditing((v) => !v); setError(null); }}
          sx={{ textTransform: "none", fontSize: "0.8rem", color: editing ? ACCENT : MUTED, minWidth: 0 }}>
          {editing ? "Done" : "Edit"}
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap" }}>
        {(editing ? reachable : shown).map((b) => {
          const off = hidden.includes(b.id);
          return (
            <Box key={b.id}
              component={editing ? "div" : b.external ? "a" : Link}
              {...(editing ? {} : { href: b.href })}
              {...(!editing && b.external ? { target: "_blank", rel: "noopener" } : {})}
              sx={{ ...tile, opacity: editing && off ? 0.42 : 1, cursor: editing ? "default" : "pointer" }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: "12px", display: "grid", placeItems: "center",
                bgcolor: b.tint, color: b.fg, "& svg": { fontSize: 20 },
              }}>{glyph(b)}</Box>
              <Box>
                <Typography sx={{ fontSize: "0.77rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>{b.name}</Typography>
                <Typography sx={{ fontSize: "0.67rem", color: FAINT, lineHeight: 1.25 }}>{b.note}</Typography>
              </Box>
              {editing && (
                <Tooltip title={off ? "Show this" : "Hide this"}>
                  <IconButton size="small" onClick={() => toggle(b.id)} aria-label={off ? `Show ${b.name}` : `Hide ${b.name}`}
                    sx={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, bgcolor: "#fff", boxShadow: 1 }}>
                    {off ? <AddIcon sx={{ fontSize: 14 }} /> : <CloseIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        })}

        {custom.map((c, i) => (
          <Box key={`${c.href}-${i}`}
            component={editing ? "div" : /^https?:/i.test(c.href) ? "a" : Link}
            {...(editing ? {} : { href: c.href })}
            {...(!editing && /^https?:/i.test(c.href) ? { target: "_blank", rel: "noopener" } : {})}
            sx={{ ...tile, cursor: editing ? "default" : "pointer" }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: "12px", display: "grid", placeItems: "center",
              bgcolor: "#e9eef5", color: "#4a5a70", "& svg": { fontSize: 20 },
            }}><LinkIcon /></Box>
            <Box>
              <Typography sx={{ fontSize: "0.77rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>{c.label}</Typography>
              <Typography sx={{ fontSize: "0.67rem", color: FAINT, lineHeight: 1.25 }}>Yours</Typography>
            </Box>
            {editing && (
              <Tooltip title="Remove">
                <IconButton size="small" onClick={() => remove(i)} aria-label={`Remove ${c.label}`}
                  sx={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, bgcolor: "#fff", boxShadow: 1 }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))}
      </Box>

      {editing && (
        <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid rgba(21,34,58,.08)", display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField size="small" label="Name" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ width: 150 }} />
          <TextField size="small" label="Address" placeholder="https://… or /docs" value={href}
            onChange={(e) => setHref(e.target.value)} sx={{ flex: "1 1 220px", minWidth: 0 }} />
          <Button size="small" variant="contained" onClick={add} disabled={saving} sx={{ textTransform: "none", mt: 0.25 }}>
            Add
          </Button>
          {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18", width: "100%" }}>{error}</Typography>}
          {custom.length >= 12 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, width: "100%" }}>
              Twelve is the limit — remove one to add another.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
