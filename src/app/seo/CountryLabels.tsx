"use client";

/**
 * COUNTRY LABELS — the homepages Google cannot place.
 *
 * The site publishes the same homepage fourteen times, once per locale. What
 * stops Google treating those as fourteen competing duplicates is hreflang:
 * each copy lists the others AND itself, and Google then serves the Italian
 * one in Italy and the Swiss one in Switzerland.
 *
 * The self-reference is the part that fails quietly. A page can emit a
 * perfectly healthy-looking list of eleven alternates and still be invisible
 * to the cluster if its own address is not one of them — and nothing in
 * Search Console says so. You find out the way we did: by noticing that
 * /de-INT/ had become the most-clicked page on the site while the Swiss
 * homepage, which should serve Switzerland, was nowhere.
 *
 * So this block reads the live pages and says plainly which ones are not in
 * their own list. It is on the overview rather than buried in a sub-app
 * because it is one of the few SEO faults here that costs real traffic and
 * cannot be seen from the Search Console numbers alone.
 */

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import RefreshIcon from "@mui/icons-material/Refresh";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";

type Check = { locale: string; url: string; selfReferenced: boolean | null; error: string | null };
type Verdict = {
  ok: boolean; cached: boolean; at: string;
  checked: number; okCount?: number; orphans: Check[]; unreadable: Check[];
};

/**
 * One fetch, two readers: the card below, and the "where the work is" row on
 * the overview that counts label faults alongside the three analyses. Lifted
 * into a hook so the overview owns the call and nothing asks twice.
 */
export function useHreflang() {
  const [v, setV] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback((refresh: boolean) => {
    setBusy(true);
    setFailed(null);
    fetch(`/api/seo/hreflang${refresh ? "?refresh=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setV(j))
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : "The check could not run."))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => { load(false); }, [load]);

  return { v, busy, failed, load };
}

export default function CountryLabels({ state }: { state: ReturnType<typeof useHreflang> }) {
  const { v, busy, failed, load } = state;
  const orphans = v?.orphans ?? [];
  const unreadable = v?.unreadable ?? [];

  return (
    <GlassCard>
      <CardTitle
        icon={<TravelExploreIcon />}
        tint={orphans.length > 0 ? "amber" : "green"}
        title="Country labels on the homepages"
        note="Whether each locale homepage is named in its own hreflang set — the thing that stops Google choosing between them."
        right={
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            disabled={busy}
            onClick={() => load(true)}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
          >
            {busy ? "Reading…" : "Re-check"}
          </Button>
        }
      />

      {failed && <Notice tone="bad">{failed}</Notice>}

      {!failed && v === null && (
        <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Reading the live homepages…</Typography>
      )}

      {v !== null && orphans.length === 0 && unreadable.length === 0 && (
        <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.6 }}>
          All {v.checked} locale homepages are named in their own hreflang set. Google can tell them apart.
        </Typography>
      )}

      {orphans.length > 0 && (
        <>
          <Notice tone="warn">
            {orphans.length} of {v?.checked} homepages publish a list of alternates that leaves themselves out.
            A set without a self-reference is invalid, so Google does not join these pages to the cluster —
            it treats each as a standalone page and picks whichever it likes.
          </Notice>

          <Box sx={{ mt: 2 }}>
            {orphans.map((o, i) => (
              <Box
                key={o.locale}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5, py: 1.1, flexWrap: "wrap",
                  borderTop: i === 0 ? "none" : `1px solid ${HAIRLINE}`,
                }}
              >
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, minWidth: 72 }}>
                  {o.locale}
                </Typography>
                <Typography
                  component="a"
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: "0.82rem", color: MUTED, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                >
                  {o.url}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography sx={{ mt: 2, fontSize: "0.82rem", color: MUTED, lineHeight: 1.65 }}>
            The fix is one line per page in the shop&rsquo;s hreflang block: add each of these to the set every
            locale publishes, pointing at itself. Nothing else about the pages needs to change — the copy is
            already right, Google simply has not been told which country it is for.
          </Typography>
        </>
      )}

      {unreadable.length > 0 && (
        <Typography sx={{ mt: 2, fontSize: "0.8rem", color: FAINT, lineHeight: 1.6 }}>
          Could not read {unreadable.map((u) => u.locale).join(", ")} ({unreadable[0]?.error}). Those are left out
          of the verdict rather than counted as faults — press Re-check.
        </Typography>
      )}

      {v && (
        <Typography sx={{ mt: 1.5, fontSize: "0.74rem", color: FAINT }}>
          Read from the live site{v.cached ? " (cached)" : ""} at{" "}
          {new Date(v.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.
        </Typography>
      )}
    </GlassCard>
  );
}
