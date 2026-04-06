"use client";
import PageHeader from "@/app/PageHeader";

import { useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import ShieldIcon from "@mui/icons-material/Shield";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import { knowledgeBaseDocuments } from "@/lib/mockData";

const typeColorMap: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
  Brand: "info",
  Product: "primary",
  Strategy: "secondary",
  Reference: "default",
  SEO: "success",
};

const typeCustomColors: Record<string, { bg: string; color: string }> = {
  Brand: { bg: "#e0f2f1", color: "#00695c" },
  Product: { bg: "#e3f2fd", color: "#1565c0" },
  Strategy: { bg: "#f3e5f5", color: "#7b1fa2" },
  Reference: { bg: "#f5f5f5", color: "#616161" },
  SEO: { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState(
    knowledgeBaseDocuments.map((doc) => ({ ...doc }))
  );

  const handleToggleShared = (id: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id ? { ...doc, shared: !doc.shared } : doc
      )
    );
  };

  const sharedCount = documents.filter((d) => d.shared).length;

  return (
    <>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 3,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <PageHeader
            title="Knowledge Base"
            subtitle="Manage brand guidelines, product catalogs & domain knowledge for AI-powered content generation"
          />
        </Box>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          sx={{ whiteSpace: "nowrap" }}
        >
          Upload Document
        </Button>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
        All documents in the knowledge base are used as context for AI content
        generation. Only upload documents you want the AI to reference. Documents
        marked as &ldquo;Shared with AI&rdquo; are included in generation
        prompts.
      </Alert>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total Documents
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                8
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Shared with AI
              </Typography>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: "success.main" }}
              >
                {sharedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Apr 1, 2026
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: "center", py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Storage Used
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                22.1 MB
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Documents Table */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="center">Shared with AI</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => {
                const colors = typeCustomColors[doc.type] ?? {
                  bg: "#f5f5f5",
                  color: "#616161",
                };
                return (
                  <TableRow key={doc.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <DescriptionIcon
                          fontSize="small"
                          sx={{ color: "text.secondary" }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {doc.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={doc.type}
                        size="small"
                        sx={{
                          bgcolor: colors.bg,
                          color: colors.color,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{doc.version}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{doc.size}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{doc.lastUpdated}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="When enabled, this document is included in AI content generation prompts">
                        <Switch
                          checked={doc.shared}
                          onChange={() => handleToggleShared(doc.id)}
                          color="success"
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton size="small">
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Brand Voice Config Card */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Brand Voice Configuration
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Tone
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Professional, Technical, Authoritative
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Style
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                B2B Engineering Partner
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Formality
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Formal
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Language Preference
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Clear, precise, industry-standard terminology
              </Typography>
            </Grid>
          </Grid>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              <InfoIcon
                fontSize="small"
                sx={{ verticalAlign: "middle", mr: 0.5 }}
              />
              Brand voice settings are applied as hard constraints in every
              content generation prompt
            </Typography>
            <Button variant="outlined" startIcon={<EditIcon />}>
              Edit Brand Voice
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Data Flow Transparency Card */}
      <Card variant="outlined">
        <CardContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
            }}
          >
            <ShieldIcon color="success" />
            <Typography variant="h6">What Data Goes Where</Typography>
            <Chip
              icon={<CheckCircleIcon />}
              label="GDPR Compliant"
              color="success"
              size="small"
              variant="outlined"
              sx={{ ml: "auto" }}
            />
          </Box>
          <Divider sx={{ mb: 3 }} />

          {/* Data flow diagram */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              flexWrap: "wrap",
              mb: 3,
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                px: 3,
                py: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderColor: "primary.main",
                borderWidth: 2,
              }}
            >
              <ShieldIcon
                fontSize="small"
                sx={{ color: "primary.main", mb: 0.5 }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Knowledge Base
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (local)
              </Typography>
            </Paper>

            <ArrowForwardIcon sx={{ color: "text.secondary" }} />

            <Paper
              variant="outlined"
              sx={{
                px: 3,
                py: 2,
                textAlign: "center",
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Claude API
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (EU region)
              </Typography>
            </Paper>

            <ArrowForwardIcon sx={{ color: "text.secondary" }} />

            <Paper
              variant="outlined"
              sx={{
                px: 3,
                py: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderColor: "success.main",
                borderWidth: 2,
              }}
            >
              <CheckCircleIcon
                fontSize="small"
                sx={{ color: "success.main", mb: 0.5 }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Generated Content
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (local)
              </Typography>
            </Paper>
          </Box>

          {/* Labels */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Chip
              icon={<ShieldIcon />}
              label="Data is NOT stored by Anthropic between API calls"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 500 }}
            />
            <Chip
              icon={<ShieldIcon />}
              label="NO PII is transmitted"
              variant="outlined"
              size="small"
              color="success"
              sx={{ fontWeight: 500 }}
            />
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
