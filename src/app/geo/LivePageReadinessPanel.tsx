"use client";

/**
 * Panel B — LIVE PAGE READINESS.
 *
 * Top pages come from GET /api/integrations/gsc?dimension=page. That route
 * answers in three shapes and each is handled explicitly here:
 *   { configured:false, missing }            → not-connected card
 *   { configured:true, ok:false, error }     → upstream error card
 *   { configured:true, ok:true, data }       → the real rows
 * Manual URL entry stays available in all three cases, so an unconnected
 * Search Console never blocks auditing a published page.
 */

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { GeoAuditResult } from "@/lib/geo/audit";
import {
  C,
  DISPLAY_FONT,
  LoadingCard,
  NotConnectedCard,
  Panel,
  ScoreBadge,
  SectionLabel,
  UpstreamErrorCard,
} from "./geoUi";
import CheckResults from "./CheckResults";

/** Window and page count requested from Search Console. */
const GSC_DAYS = 28;
const TOP_PAGES_SHOWN = 15;

type GscRow = {
  key: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

type GscState =
  | { phase: "loading" }
  | { phase: "unauthorized" }
  | { phase: "transport-error"; message: string }
  | { phase: "not-configured"; missing: string[]; detail?: string | null }
  | { phase: "upstream-error"; error: string; status?: number | null }
  | { phase: "ready"; siteUrl: string; rows: GscRow[] };

type PageAudit = {
  url: string;
  finalUrl: string;
  title: string | null;
  words: number;
  audit: GeoAuditResult;
  page: {
    schemaTypes: string[];
    hasFaqPageSchema: boolean;
    hasArticleSchema: boolean;
    hasJsonLdBlock: boolean;
    machineDates: string[];
    visibleDate: string | null;
  };
};

type AuditState =
  | { phase: "idle" }
  | { phase: "running"; url: string }
  | { phase: "error"; message: string }
  | { phase: "done"; result: PageAudit };

function fmt(n: number | null, digits = 0): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function SchemaFlag({ ok, label, missingHint }: { ok: boolean; label: string; missingHint: string }) {
  const color = ok ? "#1e7e45" : "#c5221f";
  return (
    <Tooltip title={ok ? `${label} found in the page's JSON-LD.` : missingHint}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.5,
          border: `1px solid ${color}55`,
          bgcolor: `${color}10`,
          borderRadius: "2px",
          fontSize: 11.5,
          fontWeight: 600,
          color,
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color }} />
        {label}: {ok ? "present" : "absent"}
      </Box>
    </Tooltip>
  );
}

export default function LivePageReadinessPanel() {
  const [gsc, setGsc] = useState<GscState>({ phase: "loading" });
  const [url, setUrl] = useState("");
  const [audit, setAudit] = useState<AuditState>({ phase: "idle" });

  const loadGsc = useCallback(async () => {
    setGsc({ phase: "loading" });
    try {
      const res = await fetch(`/api/integrations/gsc?dimension=page&days=${GSC_DAYS}`);
      if (res.status === 401) {
        setGsc({ phase: "unauthorized" });
        return;
      }
      if (!res.ok) {
        setGsc({ phase: "transport-error", message: `The Search Console route replied ${res.status}.` });
        return;
      }
      const body = (await res.json()) as {
        configured?: boolean;
        missing?: string[];
        detail?: string | null;
        ok?: boolean;
        error?: string;
        status?: number | null;
        data?: { siteUrl?: string; rows?: GscRow[] };
      };
      if (body.configured === false) {
        setGsc({ phase: "not-configured", missing: body.missing ?? [], detail: body.detail ?? null });
        return;
      }
      if (body.ok === false) {
        setGsc({ phase: "upstream-error", error: body.error ?? "Search Console returned no detail.", status: body.status ?? null });
        return;
      }
      setGsc({
        phase: "ready",
        siteUrl: body.data?.siteUrl ?? "",
        rows: Array.isArray(body.data?.rows) ? body.data.rows : [],
      });
    } catch (err) {
      setGsc({
        phase: "transport-error",
        message: err instanceof Error ? err.message : "The Search Console route could not be reached.",
      });
    }
  }, []);

  useEffect(() => {
    loadGsc();
  }, [loadGsc]);

  const runAudit = useCallback(async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    setAudit({ phase: "running", url: trimmed });
    try {
      const res = await fetch("/api/geo/audit-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.status === 401) {
        setAudit({ phase: "error", message: "Your session expired. Sign in again to audit a live page." });
        return;
      }
      const body = (await res.json()) as { ok?: boolean; error?: string; data?: PageAudit };
      if (!body.ok || !body.data) {
        setAudit({ phase: "error", message: body.error ?? `The audit route replied ${res.status}.` });
        return;
      }
      setAudit({ phase: "done", result: body.data });
    } catch (err) {
      setAudit({
        phase: "error",
        message: err instanceof Error ? err.message : "The audit route could not be reached.",
      });
    }
  }, []);

  const sourceBlock = () => {
    if (gsc.phase === "loading") return <LoadingCard label="Asking Search Console for the top pages…" />;
    if (gsc.phase === "not-configured") {
      return (
        <NotConnectedCard
          source="Google Search Console"
          missing={gsc.missing.length ? gsc.missing : ["GOOGLE_SERVICE_ACCOUNT", "GSC_SITE_URL"]}
          detail={gsc.detail}
          unlocks="Once connected, this panel ranks the pages that already earn impressions and lets you audit each one in place — so you fix the pages an answer engine is most likely to reach first."
        />
      );
    }
    if (gsc.phase === "unauthorized") {
      return (
        <UpstreamErrorCard
          source="Search Console"
          error="Your session expired — sign in again to load the top pages."
          onRetry={loadGsc}
        />
      );
    }
    if (gsc.phase === "transport-error") {
      return <UpstreamErrorCard source="Search Console" error={gsc.message} onRetry={loadGsc} />;
    }
    if (gsc.phase === "upstream-error") {
      return <UpstreamErrorCard source="Search Console" error={gsc.error} status={gsc.status} onRetry={loadGsc} />;
    }

    const rows = gsc.rows.slice(0, TOP_PAGES_SHOWN);
    return (
      <Panel>
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <SectionLabel sx={{ mr: "auto" }}>
            Top pages · last {GSC_DAYS} days · {gsc.siteUrl || "property"}
          </SectionLabel>
          <Button
            size="small"
            onClick={loadGsc}
            sx={{ textTransform: "none", color: C.navy, fontWeight: 600, fontSize: 12.5 }}
          >
            Refresh
          </Button>
        </Box>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, borderTop: `1px solid ${C.hairline}` }}>
            <Typography sx={{ fontSize: 13.5, color: C.muted }}>
              Search Console is connected but returned no page rows for the last {GSC_DAYS} days. Enter a URL
              below to audit a page directly.
            </Typography>
          </Box>
        ) : (
          rows.map((r) => (
            <Box
              key={r.key}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 2,
                py: 1.25,
                borderTop: `1px solid ${C.hairline}`,
                "&:hover": { bgcolor: C.surface },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 12.5,
                    color: C.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.key}
                </Typography>
                <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.25 }}>
                  {fmt(r.clicks)} clicks · {fmt(r.impressions)} impressions · position {fmt(r.position, 1)}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => {
                  setUrl(r.key);
                  runAudit(r.key);
                }}
                sx={{ textTransform: "none", color: C.navy, fontWeight: 600, fontSize: 12.5, flexShrink: 0 }}
              >
                Audit
              </Button>
            </Box>
          ))
        )}
      </Panel>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sourceBlock()}

      <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
        <SectionLabel sx={{ mb: 1.5 }}>Audit a published URL</SectionLabel>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            runAudit(url);
          }}
          sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="https://www.apsoparts.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            sx={{ flex: 1, minWidth: 240 }}
          />
          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={audit.phase === "running" || url.trim().length === 0}
            startIcon={
              audit.phase === "running" ? (
                <CircularProgress size={14} sx={{ color: "inherit" }} />
              ) : (
                <TravelExploreIcon fontSize="small" />
              )
            }
            sx={{
              bgcolor: C.navy,
              borderRadius: "2px",
              textTransform: "none",
              fontWeight: 600,
              px: 2.5,
              "&:hover": { bgcolor: "#1a3a4c" },
            }}
          >
            {audit.phase === "running" ? "Fetching…" : "Audit page"}
          </Button>
        </Box>
        <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 1.25 }}>
          The server fetches the page itself (15 s timeout). Only apsoparts.com and angst-pfister.com hosts are
          allowed, so this cannot be used as an open proxy.
        </Typography>
      </Panel>

      {audit.phase === "error" && (
        <UpstreamErrorCard source="The page audit" error={audit.message} onRetry={() => runAudit(url)} />
      )}

      {audit.phase === "running" && <LoadingCard label={`Fetching ${audit.url} and scoring it…`} />}

      {audit.phase === "done" && (
        <Panel sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
            <ScoreBadge score={audit.result.audit.score} size="lg" />
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: 500, color: C.ink }}>
                {audit.result.title ?? "(page has no <title>)"}
              </Typography>
              <Typography
                component="a"
                href={audit.result.finalUrl}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: 12,
                  color: C.navy,
                  mt: 0.5,
                  overflowWrap: "anywhere",
                }}
              >
                {audit.result.finalUrl}
                <OpenInNewIcon sx={{ fontSize: 13 }} />
              </Typography>
              <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.5 }}>
                {audit.result.words} words of readable text extracted from the live HTML.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <SectionLabel sx={{ mb: 1 }}>What the published HTML carries</SectionLabel>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <SchemaFlag
                ok={audit.result.page.hasFaqPageSchema}
                label="FAQPage JSON-LD"
                missingHint="No FAQPage (or QAPage) type found. Emit it from the page's actual FAQ block so the answers are machine-readable."
              />
              <SchemaFlag
                ok={audit.result.page.hasArticleSchema}
                label="Article JSON-LD"
                missingHint="No Article/TechArticle/BlogPosting type found. Emit one with headline, description and datePublished."
              />
              <SchemaFlag
                ok={audit.result.page.visibleDate !== null || audit.result.page.machineDates.length > 0}
                label="Date signal"
                missingHint="No <time datetime>, no article:published_time meta and no visible date. Add a visible 'Last updated' line and mirror it in the JSON-LD."
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: C.muted, mt: 1.25 }}>
              JSON-LD types found:{" "}
              {audit.result.page.schemaTypes.length
                ? audit.result.page.schemaTypes.join(", ")
                : audit.result.page.hasJsonLdBlock
                  ? "a ld+json block exists but declares no @type"
                  : "none"}
              {audit.result.page.visibleDate ? ` · visible date: ${audit.result.page.visibleDate}` : ""}
              {audit.result.page.machineDates.length
                ? ` · machine dates: ${audit.result.page.machineDates.join(", ")}`
                : ""}
            </Typography>
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <SectionLabel sx={{ mb: 0.5 }}>Check results</SectionLabel>
            <CheckResults audit={audit.result.audit} />
          </Box>
        </Panel>
      )}
    </Box>
  );
}
