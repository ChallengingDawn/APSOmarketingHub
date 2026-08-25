"use client";

// Settings & Governance.
//
// Two things used to be duplicated on this page as hardcoded lists that could
// never report the truth: a second "Integrations" grid (whose Connect buttons
// did nothing and whose status was a literal in an array) and a second team
// table (invented people and permissions). Both now live where they are real —
// /settings/integrations reads readiness from the status route and can test a
// live call, /admin reads the users table — and this page links across to them.
//
// The preference controls below are honest about their state: nothing persists
// them yet, and the banner says so rather than implying they are enforced.

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/app/PageHeader";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DescriptionIcon from "@mui/icons-material/Description";
import HubIcon from "@mui/icons-material/Hub";
import PeopleIcon from "@mui/icons-material/People";
import SecurityIcon from "@mui/icons-material/Security";
import ShieldIcon from "@mui/icons-material/Shield";

const NAVY = "#274e64";
const INK = "#1a1d21";
const MUTED = "#5b6470";
const HAIRLINE = "#e3e6ea";
const SURFACE = "#f5f6f8";

const LABEL_SX = {
  fontSize: "11.5px",
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase" as const,
  color: MUTED,
};

const CARD_SX = { mb: 3, borderRadius: 3, border: `1px solid ${HAIRLINE}`, boxShadow: "none" };

/* ── Section title helper ── */

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
      {icon}
      <Typography
        sx={{
          fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
          fontSize: "1.1rem",
          fontWeight: 500,
          color: INK,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}

/**
 * A pointer to the one page that owns a capability. Used instead of rendering a
 * second copy of that capability here.
 */
function CrossLink({
  icon,
  label,
  title,
  body,
  href,
  cta,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
        bgcolor: SURFACE,
        p: 2.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.25 }}>
        <Box sx={{ display: "inline-flex", color: NAVY }}>{icon}</Box>
        <Typography sx={LABEL_SX}>{label}</Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
          fontSize: "1.05rem",
          fontWeight: 500,
          color: INK,
          letterSpacing: "-0.02em",
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ fontSize: "0.83rem", color: MUTED, lineHeight: 1.65, mb: 2 }}>
        {body}
      </Typography>
      <Box sx={{ mt: "auto" }}>
        <Button
          component={Link}
          href={href}
          variant="outlined"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            color: NAVY,
            bgcolor: "#fff",
            borderColor: HAIRLINE,
            "&:hover": { borderColor: NAVY, bgcolor: "#fff" },
          }}
        >
          {cta}
        </Button>
      </Box>
    </Box>
  );
}

/* ── Page ── */

export default function SettingsPage() {
  /* Publishing toggles */
  const [requireTopicApproval, setRequireTopicApproval] = useState(true);
  const [requireContentApproval, setRequireContentApproval] = useState(true);
  const [minApprovers, setMinApprovers] = useState(1);

  /* Data & Privacy */
  const [dataRetention, setDataRetention] = useState("30");
  const [trainingOptOut, setTrainingOptOut] = useState(true);
  const [anonymizeAnalytics, setAnonymizeAnalytics] = useState(true);

  /* Content Strategy */
  const [noDuplicateDays, setNoDuplicateDays] = useState(60);
  const [maxArticlesPerWeek, setMaxArticlesPerWeek] = useState(5);
  const [refreshInterval, setRefreshInterval] = useState(14);

  return (
    <>
      <PageHeader
        title="Settings & Governance"
        subtitle="Publishing and privacy preferences — connections and user accounts live on their own pages"
      />

      {/* ── 1. Where the real controls live ── */}
      <Card sx={CARD_SX}>
        <CardContent>
          <SectionTitle icon={<HubIcon sx={{ color: NAVY }} />} title="Managed elsewhere" />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <CrossLink
                icon={<HubIcon sx={{ fontSize: 18 }} />}
                label="Data sources"
                title="Integrations"
                body="Google Analytics 4, Search Console and HubSpot are configured, checked and tested on the Integrations page — the single place in this hub that can report whether a source is actually connected, which variables are missing, and what a live call returned. Nothing about connection state is duplicated here."
                href="/settings/integrations"
                cta="Open Integrations"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <CrossLink
                icon={<PeopleIcon sx={{ fontSize: 18 }} />}
                label="Access"
                title="Team & access control"
                body="User accounts, roles and two-factor enrolment are managed in Admin · Users, which reads and writes the real user store. This page previously showed a fixed list of people that matched nobody in the database."
                href="/admin"
                cta="Open Admin · Users"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── 2. Honest state of everything below ── */}
      <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK, mb: 0.25 }}>
          The preferences below are not stored yet
        </Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
          There is no settings store behind this screen: changing a control updates this browser
          session only, it is not saved and no part of the pipeline reads it. They are shown as the
          intended pilot rules, not as active enforcement.
        </Typography>
      </Alert>

      {/* ── 3. Publishing & Approval Gates ── */}
      <Card sx={CARD_SX}>
        <CardContent>
          <SectionTitle
            icon={<ShieldIcon sx={{ color: NAVY }} />}
            title="Publishing & approval gates"
          />

          <Box
            sx={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 2,
              bgcolor: SURFACE,
              p: 2,
              mb: 2,
            }}
          >
            <Typography sx={{ ...LABEL_SX, mb: 0.75 }}>What is true today</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.65 }}>
              This hub has no CMS or social publishing integration — the only connected systems are
              read-only analytics and CRM sources. Generated content therefore stays in the content
              store until a person moves it out by hand; nothing can push it live on its own.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={requireTopicApproval}
                  onChange={(e) => setRequireTopicApproval(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Typography variant="body2" fontWeight={500}>
                  Require topic approval
                </Typography>
              }
            />

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={requireContentApproval}
                  onChange={(e) => setRequireContentApproval(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Typography variant="body2" fontWeight={500}>
                  Require content approval
                </Typography>
              }
            />

            <Divider />

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Minimum approvers required
              </Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select value={minApprovers} onChange={(e) => setMinApprovers(Number(e.target.value))}>
                  <MenuItem value={1}>1</MenuItem>
                  <MenuItem value={2}>2</MenuItem>
                  <MenuItem value={3}>3</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── 4. Data & Privacy ── */}
      <Card sx={CARD_SX}>
        <CardContent>
          <SectionTitle icon={<SecurityIcon sx={{ color: NAVY }} />} title="Data & privacy" />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Data retention</InputLabel>
                <Select
                  value={dataRetention}
                  label="Data retention"
                  onChange={(e) => setDataRetention(e.target.value)}
                >
                  <MenuItem value="7">7 days</MenuItem>
                  <MenuItem value="14">14 days</MenuItem>
                  <MenuItem value="30">30 days</MenuItem>
                  <MenuItem value="60">60 days</MenuItem>
                  <MenuItem value="90">90 days</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={trainingOptOut}
                      onChange={(e) => setTrainingOptOut(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={500}>
                      API data training opt-out
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={anonymizeAnalytics}
                      onChange={(e) => setAnonymizeAnalytics(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={500}>
                      Anonymize analytics data
                    </Typography>
                  }
                />
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />

          <Button
            component={Link}
            href="/docs/security-infrastructure"
            variant="outlined"
            startIcon={<DescriptionIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.82rem",
              color: NAVY,
              borderColor: HAIRLINE,
              "&:hover": { borderColor: NAVY, bgcolor: SURFACE },
            }}
          >
            Security, GDPR & audit documentation
          </Button>
        </CardContent>
      </Card>

      {/* ── 5. Content Strategy Rules ── */}
      <Card sx={CARD_SX}>
        <CardContent>
          <SectionTitle
            icon={<CalendarMonthIcon sx={{ color: NAVY }} />}
            title="Content strategy rules"
          />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                No duplicate parent keywords within
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  type="number"
                  size="small"
                  value={noDuplicateDays}
                  onChange={(e) => setNoDuplicateDays(Number(e.target.value))}
                  sx={{ width: 100 }}
                />
                <Typography variant="body2" sx={{ color: MUTED }}>
                  days
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Maximum AI-generated articles per week
              </Typography>
              <TextField
                type="number"
                size="small"
                value={maxArticlesPerWeek}
                onChange={(e) => setMaxArticlesPerWeek(Number(e.target.value))}
                sx={{ width: 100 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Content gap refresh interval
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  type="number"
                  size="small"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  sx={{ width: 100 }}
                />
                <Typography variant="body2" sx={{ color: MUTED }}>
                  days
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </>
  );
}
