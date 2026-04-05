"use client";

import { useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import SettingsIcon from "@mui/icons-material/Settings";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Shield";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SecurityIcon from "@mui/icons-material/Security";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import WarningIcon from "@mui/icons-material/Warning";

/* ── Types ── */

interface Integration {
  name: string;
  connected: boolean;
  details: string;
  badge?: string;
}

interface TeamMember {
  initials: string;
  name: string;
  role: string;
  roleColor: "primary" | "secondary" | "success" | "warning" | "info" | "default";
  email: string;
  permissions: string;
  permColor: "success" | "info" | "warning" | "default";
}

/* ── Mock data ── */

const integrations: Integration[] = [
  { name: "Google Analytics 4", connected: false, details: "Read-only OAuth scope" },
  { name: "Google Search Console", connected: false, details: "Read-only OAuth scope" },
  {
    name: "Anthropic Claude API",
    connected: false,
    details: "Model: claude-opus-4-6",
    badge: "EU Region",
  },
  { name: "n8n Workflows", connected: false, details: "Webhook-based automation" },
  { name: "LinkedIn API", connected: false, details: "Post scheduling & analytics" },
  { name: "Magento CMS", connected: false, details: "Draft publishing via API" },
];

const teamMembers: TeamMember[] = [
  {
    initials: "MI",
    name: "Miriam",
    role: "Admin",
    roleColor: "primary",
    email: "miriam@apsoparts.com",
    permissions: "Full access",
    permColor: "success",
  },
  {
    initials: "AL",
    name: "Aleksandra",
    role: "Editor",
    roleColor: "secondary",
    email: "aleksandra@apsoparts.com",
    permissions: "Content review & approval",
    permColor: "info",
  },
  {
    initials: "CL",
    name: "Claudio",
    role: "Developer",
    roleColor: "info",
    email: "claudio@challengingdawn.com",
    permissions: "System configuration",
    permColor: "warning",
  },
  {
    initials: "AI",
    name: "AI Pipeline",
    role: "System",
    roleColor: "default",
    email: "pipeline@system",
    permissions: "Generate drafts only",
    permColor: "default",
  },
];

/* ── Section title helper ── */

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
      {icon}
      <Typography variant="h6" fontWeight={600}>
        {title}
      </Typography>
    </Box>
  );
}

/* ── Page ── */

export default function SettingsPage() {
  /* Publishing toggles */
  const [draftOnly, setDraftOnly] = useState(true);
  const [requireTopicApproval, setRequireTopicApproval] = useState(true);
  const [requireContentApproval, setRequireContentApproval] = useState(true);
  const [autoPublish, setAutoPublish] = useState(false);
  const [minApprovers, setMinApprovers] = useState(1);

  /* Data & Privacy toggles */
  const [dataRetention, setDataRetention] = useState("30");
  const [trainingOptOut, setTrainingOptOut] = useState(true);
  const [anonymizeAnalytics, setAnonymizeAnalytics] = useState(true);

  /* Content Strategy */
  const [noDuplicateDays, setNoDuplicateDays] = useState(60);
  const [maxArticlesPerWeek, setMaxArticlesPerWeek] = useState(5);
  const [refreshInterval, setRefreshInterval] = useState(14);

  return (
    <>
      {/* ── Header ── */}
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings &amp; Governance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Configure integrations, access control &amp; publishing rules
      </Typography>

      {/* ── 1. Integrations ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <SectionTitle
            icon={<LinkIcon color="primary" />}
            title="Integrations"
          />
          <Grid container spacing={2}>
            {integrations.map((itg) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={itg.name}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    height: "100%",
                    borderColor: itg.connected
                      ? "success.light"
                      : "divider",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {itg.connected ? (
                        <CloudDoneIcon
                          sx={{ fontSize: 20, color: "success.main" }}
                        />
                      ) : (
                        <LinkOffIcon
                          sx={{ fontSize: 20, color: "text.disabled" }}
                        />
                      )}
                      <Typography variant="subtitle2" fontWeight={600}>
                        {itg.name}
                      </Typography>
                    </Box>
                    <Tooltip title="Settings">
                      <IconButton size="small">
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Chip
                    label={itg.connected ? "Connected" : "Not Connected"}
                    size="small"
                    color={itg.connected ? "success" : "default"}
                    variant={itg.connected ? "filled" : "outlined"}
                    sx={{ alignSelf: "flex-start" }}
                  />

                  {itg.badge && (
                    <Chip
                      label={itg.badge}
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ alignSelf: "flex-start" }}
                    />
                  )}

                  {itg.connected && itg.details && (
                    <Typography variant="caption" color="text.secondary">
                      {itg.details}
                    </Typography>
                  )}

                  {!itg.connected && (
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ alignSelf: "flex-start", mt: "auto" }}
                    >
                      Connect
                    </Button>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* ── 2. Publishing & Approval Gates ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <SectionTitle
            icon={<ShieldIcon color="primary" />}
            title="Publishing & Approval Gates"
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Draft-Only Mode */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draftOnly}
                      onChange={(e) => setDraftOnly(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={500}>
                      Draft-Only Mode
                    </Typography>
                  }
                />
                <Tooltip title="This setting is enforced and cannot be disabled">
                  <LockIcon
                    sx={{ fontSize: 16, color: "success.main" }}
                  />
                </Tooltip>
              </Box>
              <Chip
                label="Enforced"
                size="small"
                color="success"
                variant="outlined"
              />
            </Box>

            <Divider />

            {/* Require Topic Approval */}
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
                  Require Topic Approval
                </Typography>
              }
            />

            <Divider />

            {/* Require Content Approval */}
            <FormControlLabel
              control={
                <Switch
                  checked={requireContentApproval}
                  onChange={(e) =>
                    setRequireContentApproval(e.target.checked)
                  }
                  color="success"
                />
              }
              label={
                <Typography variant="body2" fontWeight={500}>
                  Require Content Approval
                </Typography>
              }
            />

            <Divider />

            {/* Auto-publish to CMS */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoPublish}
                      onChange={(e) => setAutoPublish(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={500}>
                      Auto-publish to CMS
                    </Typography>
                  }
                />
              </Box>
              {!autoPublish && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    ml: 6,
                    mt: -0.5,
                  }}
                >
                  <WarningIcon sx={{ fontSize: 14, color: "warning.main" }} />
                  <Typography variant="caption" color="warning.main">
                    Disabled for pilot phase
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Minimum Approvers */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1,
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                Minimum Approvers Required
              </Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={minApprovers}
                  onChange={(e) =>
                    setMinApprovers(e.target.value as number)
                  }
                >
                  <MenuItem value={1}>1</MenuItem>
                  <MenuItem value={2}>2</MenuItem>
                  <MenuItem value={3}>3</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Alert
            severity="info"
            icon={<LockIcon fontSize="small" />}
            sx={{ mt: 2 }}
          >
            These gates cannot be bypassed. All content must pass through
            human review.
          </Alert>
        </CardContent>
      </Card>

      {/* ── 3. Data & Privacy ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <SectionTitle
            icon={<SecurityIcon color="primary" />}
            title="Data & Privacy"
          />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Processing Region */}
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Processing Region
                  </Typography>
                  <Chip
                    label="🇪🇺 EU (Amsterdam)"
                    color="info"
                    variant="outlined"
                  />
                </Box>

                {/* Data Retention */}
                <Box>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Data Retention</InputLabel>
                    <Select
                      value={dataRetention}
                      label="Data Retention"
                      onChange={(e) =>
                        setDataRetention(e.target.value as string)
                      }
                    >
                      <MenuItem value="7">7 days</MenuItem>
                      <MenuItem value="14">14 days</MenuItem>
                      <MenuItem value="30">30 days</MenuItem>
                      <MenuItem value="60">60 days</MenuItem>
                      <MenuItem value="90">90 days</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {/* API Data Training Opt-out */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={trainingOptOut}
                        onChange={(e) =>
                          setTrainingOptOut(e.target.checked)
                        }
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={500}>
                        API Data Training Opt-out
                      </Typography>
                    }
                  />
                  <Tooltip title="This setting is locked for compliance">
                    <LockIcon
                      sx={{ fontSize: 16, color: "warning.main" }}
                    />
                  </Tooltip>
                </Box>

                {/* Anonymize analytics data */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={anonymizeAnalytics}
                      onChange={(e) =>
                        setAnonymizeAnalytics(e.target.checked)
                      }
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

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button variant="outlined" startIcon={<ShieldIcon />}>
              View GDPR Compliance Report
            </Button>
            <Button variant="outlined" startIcon={<SecurityIcon />}>
              Download DPA
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* ── 4. Team & Access Control ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <SectionTitle
            icon={<PeopleIcon color="primary" />}
            title="Team & Access Control"
          />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.email} hover>
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: 13,
                            bgcolor:
                              member.roleColor === "primary"
                                ? "primary.main"
                                : member.roleColor === "secondary"
                                  ? "secondary.main"
                                  : member.roleColor === "info"
                                    ? "info.main"
                                    : "grey.500",
                          }}
                        >
                          {member.initials}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>
                          {member.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={member.role}
                        size="small"
                        color={member.roleColor}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {member.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={member.permissions}
                        size="small"
                        color={member.permColor}
                        variant="filled"
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<PeopleIcon />}>
              Invite Team Member
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* ── 5. Content Strategy Rules ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <SectionTitle
            icon={<CalendarMonthIcon color="primary" />}
            title="Content Strategy Rules"
          />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* No duplicate parent keywords */}
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    gutterBottom
                  >
                    No duplicate parent keywords within
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <TextField
                      type="number"
                      size="small"
                      value={noDuplicateDays}
                      onChange={(e) =>
                        setNoDuplicateDays(Number(e.target.value))
                      }
                      sx={{ width: 100 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      days
                    </Typography>
                  </Box>
                </Box>

                {/* Quarterly strategy review */}
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    gutterBottom
                  >
                    Quarterly strategy review
                  </Typography>
                  <Chip
                    icon={<CalendarMonthIcon />}
                    label="Next review: Apr 15, 2026"
                    variant="outlined"
                    color="info"
                  />
                </Box>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Max articles per week */}
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    gutterBottom
                  >
                    Maximum AI-generated articles per week
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={maxArticlesPerWeek}
                    onChange={(e) =>
                      setMaxArticlesPerWeek(Number(e.target.value))
                    }
                    sx={{ width: 100 }}
                  />
                </Box>

                {/* Content gap refresh interval */}
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    gutterBottom
                  >
                    Content gap refresh interval
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <TextField
                      type="number"
                      size="small"
                      value={refreshInterval}
                      onChange={(e) =>
                        setRefreshInterval(Number(e.target.value))
                      }
                      sx={{ width: 100 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      days
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </>
  );
}
