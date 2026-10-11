"use client";

/**
 * PERFORMANCE BY COUNTRY.
 *
 * Sits under the country-labels block on purpose: the two answer each other.
 * One says which homepages Google cannot place; this one says what that is
 * worth. Italy earns more organic clicks than Switzerland and Germany on a
 * fraction of the spend — the question Alexandre asked — and the reason is
 * directly above it, that the Italian pages are labelled and the German ones
 * are not.
 *
 * Its own call, not a slice of the shell's data: the cockpit's four loads use
 * the query and page dimensions, and country is a fifth. Keeping it separate
 * means a country call that fails costs this card and nothing else.
 */

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PublicIcon from "@mui/icons-material/Public";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { fetchGsc } from "./gscClient";
import { fmtCtr, fmtInt, fmtPosition, NUMERIC } from "./ui";

/** How many countries to show before the tail stops being interesting. */
const TOP = 8;

type Row = { key: string; clicks: number | null; impressions: number | null; ctr: number | null; position: number | null };

/**
 * Search Console answers in ISO 3166-1 alpha-3, lower case. Resolved by the
 * browser rather than a lookup table of our own, so it stays right and
 * follows the reader's language.
 */
const NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const ALPHA3_TO_2: Record<string, string> = {
  che: "CH", deu: "DE", ita: "IT", fra: "FR", aut: "AT", nld: "NL", pol: "PL",
  gbr: "GB", usa: "US", esp: "ES", bel: "BE", swe: "SE", cze: "CZ", tur: "TR",
  ind: "IN", chn: "CN", bra: "BR", dnk: "DK", fin: "FI", nor: "NO", prt: "PT",
};

function countryName(code: string): string {
  const two = ALPHA3_TO_2[code.toLowerCase()];
  if (!two) return code.toUpperCase();
  try {
    return NAMES.of(two) ?? two;
  } catch {
    return two;
  }
}

export default function ByCountry() {
  const { window: win } = useReportingWindow();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    const controller = new AbortController();
    fetchGsc({ dimension: "country", from: win.from, to: win.to }, controller.signal)
      .then((res) => {
        if (!res.configured) return setError("Search Console is not connected.");
        if (!res.ok) return setError(res.error);
        setRows(res.data.rows);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "The country call failed."));
    return () => controller.abort();
  }, [win.from, win.to]);

  useEffect(load, [load]);

  const top = (rows ?? []).slice().sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0)).slice(0, TOP);
  const most = top[0]?.clicks ?? 0;

  return (
    <GlassCard>
      <CardTitle
        icon={<PublicIcon />}
        tint="slate"
        title="Where the clicks come from"
        note="Organic clicks by country, for the window above."
      />

      {error && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{error}</Typography>}
      {!error && rows === null && (
        <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Asking Search Console…</Typography>
      )}

      {top.length > 0 && (
        <Box>
          <Box sx={{ display: "flex", gap: 2, pb: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ flex: 1, fontSize: "0.68rem", fontWeight: 600, color: FAINT, letterSpacing: "0.05em" }}>
              COUNTRY
            </Typography>
            {["CLICKS", "IMPRESSIONS", "CTR", "POSITION"].map((h) => (
              <Typography key={h} sx={{ width: 86, textAlign: "right", fontSize: "0.68rem", fontWeight: 600, color: FAINT, letterSpacing: "0.05em" }}>
                {h}
              </Typography>
            ))}
          </Box>

          {top.map((r) => (
            <Box key={r.key} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ flex: 1, minWidth: 120 }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>
                  {countryName(r.key)}
                </Typography>
                {/* A bar, because eight numbers in a column do not show that one
                    country is twice the next. Decoration only — the figure beside
                    it is the fact, so this reads fine to somebody who cannot see it. */}
                <Box aria-hidden sx={{ mt: 0.5, height: 4, borderRadius: 2, bgcolor: "rgba(21,34,58,.07)" }}>
                  <Box sx={{ height: "100%", borderRadius: 2, bgcolor: "#2459d1", width: `${most > 0 ? ((r.clicks ?? 0) / most) * 100 : 0}%` }} />
                </Box>
              </Box>
              <Typography sx={{ width: 86, textAlign: "right", fontSize: "0.88rem", fontWeight: 600, color: INK, ...NUMERIC }}>
                {fmtInt(r.clicks)}
              </Typography>
              <Typography sx={{ width: 86, textAlign: "right", fontSize: "0.84rem", color: MUTED, ...NUMERIC }}>
                {fmtInt(r.impressions)}
              </Typography>
              <Typography sx={{ width: 86, textAlign: "right", fontSize: "0.84rem", color: MUTED, ...NUMERIC }}>
                {fmtCtr(r.ctr)}
              </Typography>
              <Typography sx={{ width: 86, textAlign: "right", fontSize: "0.84rem", color: MUTED, ...NUMERIC }}>
                {fmtPosition(r.position)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {rows !== null && top.length === 0 && !error && (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No country rows for this window.</Typography>
      )}
    </GlassCard>
  );
}
