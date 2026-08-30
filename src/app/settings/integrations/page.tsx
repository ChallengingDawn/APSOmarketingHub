"use client";

// The control room for the external data sources. Readiness comes from
// /api/integrations/status; "Test connection" calls the real route and reports
// exactly what came back — a proof-of-life detail on success, the upstream
// message verbatim on failure. No secret value is ever rendered here.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import {
  fetchIntegration,
  fetchIntegrationStatus,
  formatCount,
  type Ga4Overview,
  type GscPayload,
  type HubspotPayload,
  type IntegrationKey,
  type IntegrationReadiness,
  type IntegrationResult,
  type IntegrationStatusPayload,
} from "@/app/analytics/integrationApi";

const NAVY = "#274e64";
const RED = "#ed1b2f";
const INK = "#1a1d21";
const MUTED = "#5b6470";
const HAIRLINE = "#e3e6ea";
const SURFACE = "#f5f6f8";
const GREEN = "#1e7a4b";

const LABEL_SX = {
  fontSize: "11.5px",
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase" as const,
  color: MUTED,
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type TestOutcome =
  | { kind: "pending" }
  | { kind: "not-configured"; missing: string[] }
  | { kind: "failed"; error: string; status: number | null; sites?: { siteUrl: string; permissionLevel: string | null }[] }
  | { kind: "passed"; proof: string };

type Definition = {
  key: IntegrationKey;
  name: string;
  purpose: string;
  required: string[];
  optional: { name: string; fallback: string }[];
  unlocks: string[];
  /** Calls the real route and turns the answer into a UI outcome. */
  test: () => Promise<TestOutcome>;
};

function proofFromGa4(data: Ga4Overview): string {
  const rows = `${data.daily.length} daily row${data.daily.length === 1 ? "" : "s"}`;
  const sessions =
    data.totals && data.totals.sessions !== null
      ? `, ${formatCount(data.totals.sessions)} sessions in the sampled window`
      : "";
  return `GA4 property ${data.propertyId} answered: ${rows}${sessions}.`;
}

function proofFromGsc(data: GscPayload): string {
  const verified =
    data.sites && data.sites.length > 0
      ? ` Verified properties visible to the service account: ${data.sites.map((s) => s.siteUrl).join(", ")}.`
      : "";
  return `Search Console answered for ${data.siteUrl}: ${data.rows.length} ${data.dimension} row${data.rows.length === 1 ? "" : "s"} in the sampled window.${verified}`;
}

function proofFromHubspot(data: HubspotPayload): string {
  const portal =
    data.account === null || data.account.portalId === null
      ? "an unnamed portal"
      : `portal ${data.account.portalId}`;
  const domain = data.account?.uiDomain ? ` (${data.account.uiDomain})` : "";
  const scopeNote =
    data.account === null
      ? " Portal details were refused — add the account-info scope to name the portal; CRM reads are unaffected."
      : "";
  const contacts =
    data.summary.contacts === null ? "" : `, ${formatCount(data.summary.contacts)} contacts readable`;
  return `HubSpot ${portal}${domain} answered${contacts}.${scopeNote}`;
}

async function runTest<T>(url: string, proof: (data: T) => string): Promise<TestOutcome> {
  const result: IntegrationResult<T> = await fetchIntegration<T>(url);
  if (result.state === "not-configured") return { kind: "not-configured", missing: result.missing };
  if (result.state === "error") return { kind: "failed", error: result.error, status: result.status, sites: result.sites };
  return { kind: "passed", proof: proof(result.data) };
}

const DEFINITIONS: Definition[] = [
  {
    key: "ga4",
    name: "Google Analytics 4",
    purpose: "Traffic, engagement and landing-page performance for apsoparts.com.",
    required: ["GOOGLE_SERVICE_ACCOUNT"],
    optional: [{ name: "GA4_PROPERTY_ID", fallback: "307036030" }],
    unlocks: [
      "The Analytics page: sessions, users, new users, engagement rate",
      "Daily sessions trend over a 28- or 90-day window",
      "Top landing pages and channel-group breakdown",
    ],
    test: () => runTest<Ga4Overview>("/api/integrations/ga4?days=7", proofFromGa4),
  },
  {
    key: "gsc",
    name: "Google Search Console",
    purpose: "Organic queries, impressions, clicks and average position.",
    required: ["GOOGLE_SERVICE_ACCOUNT"],
    optional: [{ name: "GSC_SITE_URL", fallback: "sc-domain:apsoparts.com" }],
    unlocks: [
      "Real search queries and pages instead of guessed keywords",
      "Impressions, CTR and average position per query",
      "The verified-property list, which is what diagnoses a wrong site string",
    ],
    test: () => runTest<GscPayload>("/api/integrations/gsc?days=7&sites=1", proofFromGsc),
  },
  {
    key: "hubspot",
    name: "HubSpot CRM",
    purpose: "Commercial signal: contact and company counts from portal 26492587.",
    required: ["HUBSPOT_TOKEN"],
    optional: [],
    unlocks: [
      "The commercial-signal card on the Analytics page",
      "Contact and company totals, plus contacts created recently",
    ],
    test: () => runTest<HubspotPayload>("/api/integrations/hubspot?days=30", proofFromHubspot),
  },
];

function Badge({ text, tone }: { text: string; tone: "ok" | "bad" | "neutral" }) {
  const palette = {
    ok: { fg: GREEN, bg: "#eaf4ee", border: "#cfe6d9" },
    bad: { fg: RED, bg: "#fdebed", border: "#f6ccd1" },
    neutral: { fg: MUTED, bg: SURFACE, border: HAIRLINE },
  }[tone];
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1.1,
        py: 0.4,
        borderRadius: 1,
        bgcolor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
      }}
    >
      {text}
    </Box>
  );
}

function Secret({ name, missing }: { name: string; missing?: boolean }) {
  return (
    <Box
      component="code"
      sx={{
        fontFamily: MONO,
        fontSize: "0.76rem",
        fontWeight: 600,
        color: missing ? RED : INK,
        bgcolor: missing ? "#fdebed" : SURFACE,
        border: `1px solid ${missing ? "#f6ccd1" : HAIRLINE}`,
        borderRadius: 1,
        px: 0.9,
        py: 0.35,
        display: "inline-block",
      }}
    >
      {name}
    </Box>
  );
}

function badgeFor(
  readiness: IntegrationReadiness | undefined,
  outcome: TestOutcome | undefined,
): { text: string; tone: "ok" | "bad" | "neutral" } {
  if (!readiness) return { text: "Unknown", tone: "neutral" };
  if (!readiness.configured) return { text: "Not connected", tone: "bad" };
  if (outcome?.kind === "passed") return { text: "Connected", tone: "ok" };
  if (outcome?.kind === "failed" || outcome?.kind === "not-configured") {
    return { text: "Error", tone: "bad" };
  }
  // Credentials are present but nothing has proven they work yet — saying
  // "Connected" here would be a claim without a response behind it.
  return { text: "Credentials present · untested", tone: "neutral" };
}

function IntegrationCard({
  definition,
  readiness,
  outcome,
  onTest,
}: {
  definition: Definition;
  readiness: IntegrationReadiness | undefined;
  outcome: TestOutcome | undefined;
  onTest: () => void;
}) {
  const badge = badgeFor(readiness, outcome);
  const missing = readiness?.missing ?? [];
  const invalid = readiness?.invalid;

  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
        bgcolor: "#fff",
        p: { xs: 2.5, md: 3 },
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, mb: 1 }}>
        <Typography
          sx={{
            fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
            fontSize: "1.1rem",
            fontWeight: 500,
            color: INK,
            letterSpacing: "-0.02em",
          }}
        >
          {definition.name}
        </Typography>
        <Badge text={badge.text} tone={badge.tone} />
      </Box>

      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2.5, lineHeight: 1.6 }}>
        {definition.purpose}
      </Typography>

      {invalid && (
        <Box sx={{ border: "1px solid #f2c9c6", bgcolor: "#fdf3f2", borderRadius: 1.5, p: 1.5, mb: 2 }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#c5221f", mb: 0.5 }}>
            The variable arrived but cannot be used
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: INK, lineHeight: 1.55 }}>{invalid}</Typography>
        </Box>
      )}

      <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 2, mb: 2 }}>
        <Typography sx={{ ...LABEL_SX, mb: 1 }}>
          {missing.length > 0 ? "Missing" : "Required"}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {definition.required.map((name) => (
            <Secret key={name} name={name} missing={missing.includes(name)} />
          ))}
        </Box>
        {definition.optional.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 0.75 }}>
              Optional — defaults apply when unset:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
              {definition.optional.map((opt) => (
                <Box key={opt.name} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  <Secret name={opt.name} />
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>→ {opt.fallback}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {readiness?.detail && (
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.5, fontStyle: "italic" }}>
            {readiness.detail}
          </Typography>
        )}
      </Box>

      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ ...LABEL_SX, mb: 1 }}>Unlocks</Typography>
        <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
          {definition.unlocks.map((item) => (
            <Box component="li" key={item} sx={{ mb: 0.4 }}>
              <Typography sx={{ fontSize: "0.8rem", color: INK, lineHeight: 1.5 }}>{item}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: "auto" }}>
        <Button
          onClick={onTest}
          disabled={outcome?.kind === "pending"}
          variant="outlined"
          startIcon={
            outcome?.kind === "pending" ? (
              <CircularProgress size={13} sx={{ color: NAVY }} />
            ) : undefined
          }
          sx={{
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            color: NAVY,
            borderColor: HAIRLINE,
            "&:hover": { borderColor: NAVY, bgcolor: SURFACE },
          }}
        >
          {outcome?.kind === "pending" ? "Testing…" : "Test connection"}
        </Button>

        {outcome && outcome.kind !== "pending" && (
          <Box
            sx={{
              mt: 2,
              border: `1px solid ${outcome.kind === "passed" ? "#cfe6d9" : "#f6ccd1"}`,
              borderRadius: 1.5,
              bgcolor: outcome.kind === "passed" ? "#f4faf6" : "#fff7f8",
              p: 1.5,
            }}
          >
            <Typography
              sx={{
                ...LABEL_SX,
                color: outcome.kind === "passed" ? GREEN : RED,
                mb: 0.75,
              }}
            >
              {outcome.kind === "passed"
                ? "Live response received"
                : outcome.kind === "not-configured"
                  ? "No credentials"
                  : outcome.status === null
                    ? "Upstream failure"
                    : `Upstream failure · HTTP ${outcome.status}`}
            </Typography>
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: "0.76rem",
                color: INK,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: 1.55,
              }}
            >
              {outcome.kind === "passed"
                ? outcome.proof
                : outcome.kind === "not-configured"
                  ? `The route reports these variables are not set: ${outcome.missing.join(", ") || "(none named)"}`
                  : outcome.error}
            </Typography>
            {outcome.kind === "failed" && outcome.sites !== undefined && (
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: "0.76rem",
                  color: INK,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  mt: 1,
                }}
              >
                {outcome.sites.length === 0
                  ? "Search Console lists NO properties for this service account. It has not been added as a user on any property yet — that is the whole problem, not the site string. An existing owner of the apsoparts.com property has to add the service-account email under Settings → Users and permissions. If no one holds that property, it has to be created and verified first."
                  : `Properties this service account can actually see: ${outcome.sites
                      .map((s) => `${s.siteUrl}${s.permissionLevel ? ` (${s.permissionLevel})` : ""}`)
                      .join(", ")}. If the one you expect is missing, it has not been shared with the service account; if it is present but spelled differently, set GSC_SITE_URL to match it exactly.`}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function GuideStep({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          bgcolor: NAVY,
          color: "#fff",
          fontSize: "0.72rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {index}
      </Box>
      <Box>
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, mb: 0.5 }}>
          {title}
        </Typography>
        <Box sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.65 }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default function IntegrationsSettingsPage() {
  const [status, setStatus] = useState<IntegrationResult<IntegrationStatusPayload> | null>(null);
  // Which build the container is running — from /api/health, which is the one
  // route the load balancer can always reach. "unknown" means the image was
  // built before CI started stamping it.
  const [build, setBuild] = useState<{ shortCommit: string; builtAt: string } | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<IntegrationKey, TestOutcome>>>({});

  const loadStatus = useCallback(() => {
    setStatus(null);
    fetchIntegrationStatus()
      .then((result) => setStatus(result))
      .catch(() => {
        /* aborted */
      });
  }, []);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => {
        if (h && typeof h.shortCommit === "string") {
          setBuild({ shortCommit: h.shortCommit, builtAt: typeof h.builtAt === "string" ? h.builtAt : "unknown" });
        }
      })
      .catch(() => setBuild(null));
    loadStatus();
  }, [loadStatus]);

  const test = useCallback((definition: Definition) => {
    setOutcomes((prev) => ({ ...prev, [definition.key]: { kind: "pending" } }));
    definition
      .test()
      .then((outcome) => setOutcomes((prev) => ({ ...prev, [definition.key]: outcome })))
      .catch((err: unknown) =>
        setOutcomes((prev) => ({
          ...prev,
          [definition.key]: {
            kind: "failed",
            error: err instanceof Error ? err.message : "The test request failed before a response arrived.",
            status: null,
          },
        })),
      );
  }, []);

  const readiness = status?.state === "ok" ? status.data.integrations : null;
  const envDiag = status?.state === "ok" ? status.data.env : null;

  return (
    <Box sx={{ p: 1 }}>
      <PageHeader
        title="Integrations"
        subtitle="Connect GA4, Search Console and HubSpot — the sources every live figure in this hub is read from"
        rightSlot={
          <Button
            onClick={loadStatus}
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8rem", color: NAVY }}
          >
            Re-check
          </Button>
        }
      />

      {status === null && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 6, justifyContent: "center" }}>
          <CircularProgress size={18} sx={{ color: NAVY }} />
          <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Reading integration status…</Typography>
        </Box>
      )}

      {status?.state === "error" && (
        <Box
          sx={{
            border: `1px solid ${HAIRLINE}`,
            borderLeft: `3px solid ${RED}`,
            borderRadius: 2,
            bgcolor: "#fff",
            p: 2.5,
            mb: 3,
          }}
        >
          <Typography sx={{ ...LABEL_SX, color: RED, mb: 0.75 }}>Status unavailable</Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: "0.78rem", color: INK }}>
            {status.error}
          </Typography>
        </Box>
      )}

      {status?.state === "not-configured" && (
        <Box
          sx={{
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 2,
            bgcolor: "#fff",
            p: 2.5,
            mb: 3,
          }}
        >
          <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
            The status route reported no readiness object. Set the variables listed below and re-check.
          </Typography>
        </Box>
      )}

      {readiness && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {DEFINITIONS.map((definition) => (
            <Grid key={definition.key} size={{ xs: 12, md: 4 }}>
              <IntegrationCard
                definition={definition}
                readiness={readiness[definition.key]}
                outcome={outcomes[definition.key]}
                onTest={() => test(definition)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {envDiag && (
        <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2, bgcolor: "#fff", p: { xs: 2.5, md: 3 }, mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 0.75 }}>
            <Typography sx={{ ...LABEL_SX }}>What the running container actually sees</Typography>
            {build && (
              <Typography sx={{ fontFamily: MONO, fontSize: "0.76rem", color: build.shortCommit === "unknown" ? "#c5221f" : MUTED }}>
                {build.shortCommit === "unknown"
                  ? "build: unstamped image (built before CI recorded the commit)"
                  : `build ${build.shortCommit} · ${build.builtAt}`}
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2 }}>
            Names, lengths and shapes only — no value is ever read into this page. If a variable you added shows as absent
            here it did not reach the container: the service is still on the old task-definition revision, the deployment
            has not rolled over yet, or the environment key is not spelled exactly as shown.
          </Typography>
          <Box sx={{ display: "grid", gap: 1 }}>
            {envDiag.probes.map((probe) => (
              <Box
                key={probe.name}
                sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap", borderBottom: `1px solid ${HAIRLINE}`, pb: 1 }}
              >
                <Typography sx={{ fontFamily: MONO, fontSize: "0.8rem", color: INK, minWidth: 230 }}>{probe.name}</Typography>
                <Typography
                  sx={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: probe.present ? "#1e7e45" : probe.optional ? MUTED : "#c5221f",
                    minWidth: 70,
                  }}
                >
                  {probe.present ? "present" : probe.optional ? "optional" : "absent"}
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                  {probe.present
                    ? `${probe.length} characters · ${probe.shape}`
                    : probe.optional
                      ? `not set — the default ${probe.fallback} applies, nothing to do`
                      : "not in this container's environment"}
                </Typography>
              </Box>
            ))}
          </Box>
          {envDiag.nearMisses.length > 0 && (
            <Box sx={{ mt: 2, border: "1px solid #f2c9c6", bgcolor: "#fdf3f2", borderRadius: 1.5, p: 1.75 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#c5221f", mb: 0.5 }}>
                Near-miss environment keys found
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: "0.78rem", color: INK, wordBreak: "break-all" }}>
                {envDiag.nearMisses.join(", ")}
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.75 }}>
                These carry an expected name but are not spelled exactly right, so the app cannot read them. The key must be
                the bare name — the apso-dev/ prefix belongs to the secret in Secrets Manager, never to the environment
                variable the container receives.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ── Setup guide ── */}
      <Box
        sx={{
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 2,
          bgcolor: "#fff",
          p: { xs: 2.5, md: 3.5 },
        }}
      >
        <Typography sx={{ ...LABEL_SX, mb: 1 }}>Setup guide</Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
            fontSize: "1.25rem",
            fontWeight: 500,
            color: INK,
            letterSpacing: "-0.02em",
            mb: 2.5,
          }}
        >
          How a secret reaches this app
        </Typography>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ ...LABEL_SX, mb: 2 }}>AWS — every variable</Typography>

            <GuideStep index={1} title="Create the Secrets Manager secret">
              Name it <Secret name="apso-dev/<NAME>" /> — for example{" "}
              <Secret name="apso-dev/GOOGLE_SERVICE_ACCOUNT" />,{" "}
              <Secret name="apso-dev/GA4_PROPERTY_ID" />, <Secret name="apso-dev/GSC_SITE_URL" />,{" "}
              <Secret name="apso-dev/HUBSPOT_TOKEN" />. Store the raw value (for Google, the whole
              service-account JSON).
            </GuideStep>

            <GuideStep index={2} title="Add it to the ECS task definition">
              Reference the secret in the container definition and give the environment variable the{" "}
              <b>bare name</b>: the key must be <Secret name="GOOGLE_SERVICE_ACCOUNT" />, not{" "}
              <Secret name="apso-dev/GOOGLE_SERVICE_ACCOUNT" />. The <Secret name="apso-dev/" /> prefix
              belongs to the secret&apos;s ARN, never to the variable the app reads.
              <Box
                sx={{
                  mt: 1,
                  p: 1.25,
                  bgcolor: "#fff7f8",
                  border: "1px solid #f6ccd1",
                  borderRadius: 1,
                  color: RED,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                Keeping the prefix in the key is the mistake that has already cost this team a day —
                the app reads process.env.GOOGLE_SERVICE_ACCOUNT and finds nothing, so every card
                reports &ldquo;Not connected&rdquo;.
              </Box>
            </GuideStep>

            <GuideStep index={3} title="Force new deployment">
              A task definition revision does not reach running tasks on its own. In the ECS service,
              update to the new revision and tick <b>Force new deployment</b>, then wait for the
              rollout to finish.
            </GuideStep>

            <GuideStep index={4} title="Verify here, not in the console">
              Come back to this page, press <b>Re-check</b>, then <b>Test connection</b> on the card.
              A green panel with a live detail is the only proof that the variable arrived.
            </GuideStep>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ ...LABEL_SX, mb: 2 }}>Per-source prerequisites</Typography>

            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, mb: 1 }}>
                Google — one service account for both GA4 and Search Console
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
                {[
                  "Create a service account and download its JSON key — that JSON is the whole value of GOOGLE_SERVICE_ACCOUNT (base64 of the JSON is also accepted).",
                  "Enable the Google Analytics Data API and the Search Console API on the same Google Cloud project.",
                  "In GA4 Admin → Property access management, grant the service-account email the Viewer role on property 307036030.",
                  "In Search Console → Settings → Users and permissions, add the same service-account email as a user on the apsoparts.com property.",
                ].map((line) => (
                  <Box component="li" key={line} sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
                      {line}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, mb: 1 }}>
                HubSpot
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
                {[
                  "On portal 26492587, create a private app and grant it read scopes only (crm.objects.contacts.read and crm.objects.companies.read).",
                  "Copy the private-app access token into apso-dev/HUBSPOT_TOKEN.",
                  "The token is read per request on the server and is never sent to the browser.",
                ].map((line) => (
                  <Box component="li" key={line} sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
                      {line}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                bgcolor: SURFACE,
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 1.5,
                p: 2,
              }}
            >
              <Typography sx={{ ...LABEL_SX, mb: 0.75 }}>Secrets are never shown here</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.6 }}>
                This page displays only variable names and whether a live call succeeded. No token,
                key or private-app value is rendered — not even masked. Once GA4 is connected,{" "}
                <Box component={Link} href="/analytics" sx={{ color: NAVY, fontWeight: 600 }}>
                  the Analytics page
                </Box>{" "}
                starts showing the property&apos;s real numbers.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
