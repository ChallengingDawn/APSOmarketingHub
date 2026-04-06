"use client";
import PageHeader from "@/app/PageHeader";

import { useState } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Shield from "@mui/icons-material/Shield";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import Download from "@mui/icons-material/Download";
import Security from "@mui/icons-material/Security";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Block from "@mui/icons-material/Block";

import { auditLogs } from "@/lib/mockData";

/* ── helpers ── */

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " " + d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const actionColors: Record<string, string> = {
  "Content Generated": "#1976d2",
  "Topic Approved": "#2e7d32",
  "Pipeline Run": "#00796b",
  "Content Rejected": "#c62828",
  "Content Published": "#7b1fa2",
  "KB Updated": "#e65100",
};

/* ── compliance status cards data ── */

const complianceCards = [
  {
    title: "GDPR Status",
    badge: "Compliant",
    description: "EU processing region, no PII transmitted",
    icon: <VerifiedUser sx={{ fontSize: 32, color: "#2e7d32" }} />,
  },
  {
    title: "Auto-Publish",
    badge: "Disabled",
    description: "Draft-only mode active",
    icon: <Block sx={{ fontSize: 32, color: "#2e7d32" }} />,
  },
  {
    title: "Human Gates",
    badge: "2 Active",
    description: "Topic approval + content approval",
    icon: <Security sx={{ fontSize: 32, color: "#2e7d32" }} />,
  },
  {
    title: "Data Training",
    badge: "Opted Out",
    description: "API data not used for model training",
    icon: <Shield sx={{ fontSize: 32, color: "#2e7d32" }} />,
  },
];

/* ── data flow steps ── */

const dataFlowSteps = [
  { label: "GSC/GA4", subtitle: "(read-only)", description: "Search & analytics data ingested via API. No write access." },
  { label: "APSO Server", subtitle: "(EU)", description: "All processing in EU-West-1. Data encrypted at rest and in transit." },
  { label: "Claude API", subtitle: "(EU)", description: "EU endpoint only. No data retention. Opted out of training." },
  { label: "Draft Content", subtitle: "", description: "AI output stored as draft. Never auto-published." },
  { label: "Human Review", subtitle: "", description: "Mandatory approval gates before any content goes live." },
  { label: "CMS", subtitle: "", description: "Approved content pushed to CMS as draft for final publish." },
];

/* ── page component ── */

export default function AuditPage() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  return (
    <Box sx={{ py: 4, px: { xs: 2, md: 4 } }}>
      <PageHeader
        title="Audit & Compliance"
        subtitle="Full transparency — every AI decision, every prompt, every output logged and traceable"
      />

      {/* ── Compliance Status Cards ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {complianceCards.map(card => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderColor: "#c8e6c9",
                bgcolor: "#f9fdf9",
              }}
            >
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  {card.icon}
                  <Chip
                    label={card.badge}
                    size="small"
                    sx={{
                      bgcolor: "#e8f5e9",
                      color: "#2e7d32",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                    }}
                  />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Info Alert ── */}
      <Alert
        severity="info"
        icon={<Shield fontSize="inherit" />}
        sx={{ mb: 4, borderRadius: 2 }}
      >
        All AI interactions are logged with full prompt, input data, and output for regulatory compliance and internal review. Logs are retained for 24 months.
      </Alert>

      {/* ── Audit Log Table ── */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Audit Log
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Complete record of every action, AI generation, approval, and system event
          </Typography>
        </CardContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f5f7fa" }}>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogs.map(log => {
                const isExpanded = expandedRow === log.id;
                const isGenerated = log.action === "Content Generated";

                return (
                  <Box component="tbody" key={log.id}>
                    <TableRow
                      hover
                      onClick={() => handleToggle(log.id)}
                      sx={{ cursor: "pointer", "& > *": { borderBottom: isExpanded ? "none" : undefined } }}
                    >
                      <TableCell sx={{ width: 40, pr: 0 }}>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          sx={{
                            bgcolor: actionColors[log.action] ?? "#757575",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{log.user}</TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        <Typography variant="body2" noWrap>
                          {log.details}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* ── Expanded Row ── */}
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 0, px: 0, border: isExpanded ? undefined : "none" }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3, bgcolor: "#fafbfc" }}>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                              Full Details
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              {log.details}
                            </Typography>

                            {isGenerated && log.prompt && (
                              <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                  Prompt Sent to AI
                                </Typography>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 2,
                                    mb: 2,
                                    bgcolor: "#f5f5f5",
                                    fontFamily: "monospace",
                                    fontSize: "0.82rem",
                                    lineHeight: 1.6,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {log.prompt}
                                </Paper>

                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                  Input Data
                                </Typography>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 2,
                                    mb: 2,
                                    bgcolor: "#f5f5f5",
                                    fontFamily: "monospace",
                                    fontSize: "0.82rem",
                                    lineHeight: 1.6,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {log.input}
                                </Paper>

                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                  AI Output
                                </Typography>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 2,
                                    bgcolor: "#f5f5f5",
                                    fontFamily: "monospace",
                                    fontSize: "0.82rem",
                                    lineHeight: 1.6,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {log.output}
                                </Paper>
                              </>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Box>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Data Flow Audit Card ── */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Data Processing Audit Trail
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Every step of the data pipeline is auditable. No data leaves the EU processing region.
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0,
              overflowX: "auto",
              pb: 2,
            }}
          >
            {dataFlowSteps.map((step, idx) => (
              <Box key={step.label} sx={{ display: "flex", alignItems: "flex-start" }}>
                {/* Step card */}
                <Box
                  sx={{
                    textAlign: "center",
                    minWidth: 140,
                    maxWidth: 160,
                  }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderColor: "#c8e6c9",
                      bgcolor: "#f9fdf9",
                      borderRadius: 2,
                      position: "relative",
                    }}
                  >
                    <CheckCircle
                      sx={{
                        fontSize: 18,
                        color: "#2e7d32",
                        position: "absolute",
                        top: 6,
                        right: 6,
                      }}
                    />
                    <Typography variant="subtitle2" fontWeight={700}>
                      {step.label}
                    </Typography>
                    {step.subtitle && (
                      <Typography variant="caption" color="text.secondary">
                        {step.subtitle}
                      </Typography>
                    )}
                  </Paper>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1, px: 0.5, lineHeight: 1.3 }}
                  >
                    {step.description}
                  </Typography>
                </Box>

                {/* Arrow connector */}
                {idx < dataFlowSteps.length - 1 && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      pt: 3,
                      px: 0.5,
                      color: "#9e9e9e",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    &#8594;
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* ── Export Section ── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Export &amp; Reporting
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Download audit logs and compliance reports for internal review or regulatory submissions.
          </Typography>

          <Grid container spacing={3} alignItems="flex-end">
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="From"
                type="date"
                defaultValue="2026-03-01"
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="To"
                type="date"
                defaultValue="2026-04-04"
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  startIcon={<Download />}
                  sx={{
                    bgcolor: "#274e64",
                    "&:hover": { bgcolor: "#1b3a4b" },
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Export Audit Logs (CSV)
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  sx={{
                    borderColor: "#274e64",
                    color: "#274e64",
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": { borderColor: "#1b3a4b", bgcolor: "#f0f4f7" },
                  }}
                >
                  Export Compliance Report (PDF)
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
