"use client";
// WHAT THE HUB MAY WRITE TO YOU ABOUT.
//
// One thing, because one thing is worth a mail: a customer of yours priced
// articles in the shop and did not order. The next morning you can call them;
// a week later it is history.
//
// Off for everybody until they ask. A hub that starts mailing people because a
// feature shipped is a hub whose mail gets filtered within the week.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

export default function Notifications({ glass }: { glass: Record<string, unknown> }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setOn(!!j.prefs?.notify?.priceChecks); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(async (next: boolean) => {
    setOn(next);
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/me/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify: { priceChecks: next } }),
      });
      const text = await r.text();
      const j = text ? JSON.parse(text) : null;
      if (!j?.ok) { setError(j?.error ?? `That could not be saved. (HTTP ${r.status})`); setOn(!next); }
    } catch {
      setError("That could not be saved.");
      setOn(!next);
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            What the hub writes to you about
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
            Nothing, unless you switch it on here.
          </Typography>
        </Box>
        {saving && <Typography sx={{ fontSize: "0.76rem", color: FAINT, pt: 0.5 }}>Saving…</Typography>}
      </Box>

      {error && <Typography sx={{ fontSize: "0.82rem", color: "#9e1b18", mb: 1.5 }}>{error}</Typography>}

      <Box sx={{
        display: "flex", alignItems: "center", gap: 1.5, p: 1.75, borderRadius: "16px",
        bgcolor: "rgba(255,255,255,.55)", border: `1px solid ${HAIRLINE}`,
      }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>
            Price checks on your customers
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5, mt: 0.25 }}>
            One mail each morning, listing the customers you own who priced articles in the shop yesterday and
            did not order. Only the ones that meet the ticket rule, so a customer pricing one cheap seal does
            not reach you. No mail on a morning when nothing happened.
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.75, lineHeight: 1.45 }}>
            You are matched to your customers by your email address, which has to be the same one as in
            HubSpot. If it is not, nothing arrives and nothing says why — check Your account.
          </Typography>
        </Box>
        <Switch checked={on} disabled={!ready || saving} onChange={(e) => save(e.target.checked)} />
      </Box>
    </Box>
  );
}
