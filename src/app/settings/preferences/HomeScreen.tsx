"use client";
// YOUR HOME SCREEN.
//
// The launch pad is the first thing everybody sees and the one screen nobody
// could change. Two things here, both saved against the account rather than the
// browser, so they follow you to the other machine:
//
//   which panels you want on it, and
//   the order your apps sit in.
//
// Only apps you can actually open are listed. Ordering apps you have no access
// to would be arranging a wall you cannot see.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { APPS } from "@/app/hubApps";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

/** Everything on the launch pad that is optional. The apps themselves are not. */
export const HOME_PANELS = [
  { id: "search", name: "Search", note: "The box that finds an app or a page by name" },
  { id: "quickLinks", name: "Quick links", note: "The shop, HubSpot, and anything you add" },
  { id: "connectors", name: "Connectors", note: "Is the data flowing - shown to those with Connectors & Integration" },
  { id: "missionControl", name: "Mission Control card", note: "The panel that leads to the content calendar" },
] as const;

type Home = { hiddenPanels: string[]; appOrder: string[] };

export default function HomeScreen({ glass }: { glass: Record<string, unknown> }) {
  const [home, setHome] = useState<Home>({ hiddenPanels: [], appOrder: [] });
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setHome({
          hiddenPanels: j.prefs?.home?.hiddenPanels ?? [],
          appOrder: j.prefs?.home?.appOrder ?? [],
        });
      })
      .catch(() => {});
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setOpen(j.open as Record<string, boolean>); })
      .catch(() => {});
  }, []);

  const save = useCallback(async (next: Home) => {
    setHome(next);
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/me/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: next }),
      });
      const j = await r.json();
      if (!j?.ok) setError(j?.error ?? "That could not be saved.");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, []);

  // Their order first, then anything new that has appeared since — a sixth app
  // should turn up at the end rather than vanish because it is not in the list.
  const mine = APPS.filter((a) => !a.square && (!open || open[a.key]));
  const ordered = [
    ...home.appOrder.map((k) => mine.find((a) => a.key === k)).filter(Boolean),
    ...mine.filter((a) => !home.appOrder.includes(a.key)),
  ] as typeof mine;

  const move = (i: number, step: number) => {
    const next = [...ordered];
    const j = i + step;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save({ ...home, appOrder: next.map((a) => a.key) });
  };

  const toggle = (id: string, on: boolean) =>
    save({
      ...home,
      hiddenPanels: on ? home.hiddenPanels.filter((p) => p !== id) : [...home.hiddenPanels, id],
    });

  const touched = home.hiddenPanels.length > 0 || home.appOrder.length > 0;

  return (
    <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Your home screen
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
            What sits on the launch pad, and in what order. Saved to your account, so it follows you.
          </Typography>
        </Box>
        {saving && <Typography sx={{ fontSize: "0.76rem", color: FAINT, pt: 0.5 }}>Saving…</Typography>}
        {touched && !saving && (
          <Button size="small" startIcon={<RestartAltIcon />}
            onClick={() => save({ hiddenPanels: [], appOrder: [] })}
            sx={{ textTransform: "none", color: MUTED, flexShrink: 0 }}>
            Reset
          </Button>
        )}
      </Box>

      {error && <Typography sx={{ fontSize: "0.82rem", color: "#9e1b18", mb: 1.5 }}>{error}</Typography>}

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <Box>
          <Typography sx={{
            fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase",
            letterSpacing: "0.08em", mb: 1,
          }}>Panels</Typography>
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {HOME_PANELS.map((p) => {
              const on = !home.hiddenPanels.includes(p.id);
              return (
                <Box key={p.id} sx={{
                  display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 0.85, borderRadius: "12px",
                  bgcolor: "rgba(255,255,255,.55)", border: `1px solid ${HAIRLINE}`,
                }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: on ? INK : FAINT }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: FAINT, lineHeight: 1.35 }}>{p.note}</Typography>
                  </Box>
                  <Switch size="small" checked={on} onChange={(e) => toggle(p.id, e.target.checked)} />
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box>
          <Typography sx={{
            fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase",
            letterSpacing: "0.08em", mb: 1,
          }}>Your apps, in order</Typography>
          {ordered.length === 0 ? (
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
              You have no apps yet, so there is nothing to arrange.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {ordered.map((a, i) => (
                <Box key={a.key} sx={{
                  display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 0.7, borderRadius: "12px",
                  bgcolor: "rgba(255,255,255,.55)", border: `1px solid ${HAIRLINE}`,
                }}>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: "7px", flexShrink: 0,
                    background: `linear-gradient(140deg, ${a.from}, ${a.to})`,
                  }} />
                  <Typography sx={{
                    fontSize: "0.86rem", color: INK, flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{a.name}</Typography>
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${a.name} up`}>
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${a.name} down`}>
                    <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
