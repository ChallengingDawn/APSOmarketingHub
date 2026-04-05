"use client";
import { useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import Email from "@mui/icons-material/Email";
import Send from "@mui/icons-material/Send";
import CheckCircle from "@mui/icons-material/CheckCircle";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import CalendarTodayOutlined from "@mui/icons-material/CalendarTodayOutlined";
import StarOutlined from "@mui/icons-material/StarOutlined";

const mockNewsletters = [
  {
    id: 1,
    subject: "APSO Monthly Digest \u2014 March 2026",
    date: "2026-03-15",
    status: "Sent",
    openRate: "34.2%",
    clickRate: "8.7%",
  },
  {
    id: 2,
    subject: "Product Spotlight: High-Performance PTFE Sealing",
    date: "2026-03-01",
    status: "Sent",
    openRate: "41.5%",
    clickRate: "12.3%",
  },
  {
    id: 3,
    subject: "Industry News: Trends in Engineered Plastics 2026",
    date: "2026-04-01",
    status: "Draft",
    openRate: "\u2014",
    clickRate: "\u2014",
  },
  {
    id: 4,
    subject: "Technical Deep-Dive: FKM vs EPDM for Food Applications",
    date: "2026-04-10",
    status: "Scheduled",
    openRate: "\u2014",
    clickRate: "\u2014",
  },
];

const statusColor: Record<string, "success" | "warning" | "default"> = {
  Sent: "success",
  Scheduled: "warning",
  Draft: "default",
};

export default function NewsletterPage() {
  const [topic, setTopic] = useState("");
  const [sections, setSections] = useState("3");
  const [language, setLanguage] = useState("EN");
  const [audience, setAudience] = useState("Engineers");
  const [template, setTemplate] = useState("Monthly Digest");

  return (
    <>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            background: "linear-gradient(135deg, #274e64 0%, #1a3a4c 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Email sx={{ color: "#fff", fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
            Newsletter Studio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Design &amp; generate newsletter content for your audience
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2.5 }} />

      {/* Two-column layout */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Left: Newsletter Builder */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>
                Newsletter Builder
              </Typography>

              <TextField
                label="Newsletter Theme / Topic"
                multiline
                rows={5}
                fullWidth
                placeholder="e.g. Q2 product highlights, new sealing solutions for automotive, upcoming trade shows, sustainability initiatives..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                sx={{ mb: 3 }}
              />

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Number of Sections</InputLabel>
                    <Select
                      value={sections}
                      label="Number of Sections"
                      onChange={(e) => setSections(e.target.value)}
                    >
                      <MenuItem value="2">2 Sections</MenuItem>
                      <MenuItem value="3">3 Sections</MenuItem>
                      <MenuItem value="4">4 Sections</MenuItem>
                      <MenuItem value="5">5 Sections</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={language}
                      label="Language"
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <MenuItem value="EN">English</MenuItem>
                      <MenuItem value="DE">Deutsch</MenuItem>
                      <MenuItem value="FR">Fran\u00e7ais</MenuItem>
                      <MenuItem value="IT">Italiano</MenuItem>
                      <MenuItem value="NL">Nederlands</MenuItem>
                      <MenuItem value="PL">Polski</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Target Audience</InputLabel>
                    <Select
                      value={audience}
                      label="Target Audience"
                      onChange={(e) => setAudience(e.target.value)}
                    >
                      <MenuItem value="Engineers">Engineers</MenuItem>
                      <MenuItem value="Procurement">Procurement</MenuItem>
                      <MenuItem value="Management">Management</MenuItem>
                      <MenuItem value="General">General</MenuItem>
                      <MenuItem value="C-Suite">C-Suite</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Template</InputLabel>
                    <Select
                      value={template}
                      label="Template"
                      onChange={(e) => setTemplate(e.target.value)}
                    >
                      <MenuItem value="Monthly Digest">Monthly Digest</MenuItem>
                      <MenuItem value="Product Spotlight">Product Spotlight</MenuItem>
                      <MenuItem value="Industry News">Industry News</MenuItem>
                      <MenuItem value="Technical Deep-Dive">Technical Deep-Dive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Button
                variant="contained"
                size="large"
                startIcon={<AutoAwesome />}
                disabled={!topic}
                sx={{
                  background: "linear-gradient(135deg, #274e64 0%, #325f78 100%)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #1a3a4c 0%, #274e64 100%)",
                  },
                }}
              >
                Generate Newsletter
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Newsletter Preview */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>
                Newsletter Preview
              </Typography>

              {/* Mock Newsletter Email */}
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid #e0e0e0",
                  bgcolor: "#f7f7f7",
                }}
              >
                {/* Email Header */}
                <Box
                  sx={{
                    background: "linear-gradient(135deg, #274e64 0%, #1a3a4c 100%)",
                    px: 3,
                    py: 2.5,
                    textAlign: "center",
                  }}
                >
                  <Typography
                    sx={{
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      letterSpacing: "0.03em",
                    }}
                  >
                    APSOPARTS
                  </Typography>
                  <Typography
                    sx={{
                      color: "rgba(255,255,255,0.7)",
                      fontSize: "0.7rem",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      mt: 0.5,
                    }}
                  >
                    Monthly Newsletter &middot; April 2026
                  </Typography>
                </Box>

                {/* Email Body */}
                <Box sx={{ bgcolor: "#fff", px: 2.5, py: 2 }}>
                  {/* Section 1 */}
                  <Box sx={{ mb: 2.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <TrendingUpOutlined
                        sx={{ fontSize: 18, color: "#274e64" }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          color: "#274e64",
                        }}
                      >
                        Industry Trends
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "0.78rem",
                        color: "#444",
                        lineHeight: 1.6,
                      }}
                    >
                      The global sealing solutions market continues to evolve
                      with growing demand for high-performance materials in
                      e-mobility and hydrogen applications. New regulatory
                      standards are driving innovation across the supply chain.
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Section 2 */}
                  <Box sx={{ mb: 2.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <StarOutlined
                        sx={{ fontSize: 18, color: "#274e64" }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          color: "#274e64",
                        }}
                      >
                        Product Spotlight: PTFE Sealing
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "0.78rem",
                        color: "#444",
                        lineHeight: 1.6,
                      }}
                    >
                      Our expanded PTFE sealing range delivers exceptional
                      chemical resistance for temperatures up to +260{"\u00b0"}C.
                      Ideal for pharmaceutical, chemical processing, and food
                      industry applications with FDA/EU compliance.
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Section 3 */}
                  <Box sx={{ mb: 1 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <CalendarTodayOutlined
                        sx={{ fontSize: 18, color: "#274e64" }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          color: "#274e64",
                        }}
                      >
                        Upcoming Events
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "0.78rem",
                        color: "#444",
                        lineHeight: 1.6,
                      }}
                    >
                      Join us at Hannover Messe 2026 (April 21-25, Hall 5,
                      Stand C18) and Swiss Plastics Expo (May 12-14, Lucerne).
                      Book your personal consultation at our booth today.
                    </Typography>
                  </Box>
                </Box>

                {/* Email Footer */}
                <Box
                  sx={{
                    bgcolor: "#f0f2f5",
                    px: 2.5,
                    py: 2,
                    borderTop: "1px solid #e0e0e0",
                    textAlign: "center",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      color: "#888",
                      lineHeight: 1.6,
                    }}
                  >
                    APSOparts &middot; Sealings &amp; Plastics
                    <br />
                    www.apsoparts.com &middot; info@apsoparts.com
                    <br />
                    <span style={{ color: "#0077B5" }}>Unsubscribe</span>
                    {" "}&middot;{" "}
                    <span style={{ color: "#0077B5" }}>View in browser</span>
                  </Typography>
                </Box>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Newsletter History Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Newsletter History
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subject</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Open Rate</TableCell>
                  <TableCell>Click Rate</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockNewsletters.map((nl) => (
                  <TableRow
                    key={nl.id}
                    sx={{ "&:last-child td": { borderBottom: 0 } }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          maxWidth: 320,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {nl.subject}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {nl.date}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={nl.status}
                        size="small"
                        color={statusColor[nl.status]}
                        variant={nl.status === "Draft" ? "outlined" : "filled"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {nl.openRate}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {nl.clickRate}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" sx={{ color: "text.secondary" }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Send">
                        <IconButton size="small" sx={{ color: "text.secondary" }}>
                          <Send fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" sx={{ color: "text.secondary" }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Alert
        severity="info"
        icon={<Email />}
        sx={{ borderRadius: 3 }}
      >
        Newsletter content is generated as drafts. Review and approve before
        sending.
      </Alert>
    </>
  );
}
