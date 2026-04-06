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
import LinkedIn from "@mui/icons-material/LinkedIn";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Schedule from "@mui/icons-material/Schedule";
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ThumbUpAltOutlined from "@mui/icons-material/ThumbUpAltOutlined";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutline";
import RepeatOutlined from "@mui/icons-material/RepeatOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import PublicOutlined from "@mui/icons-material/PublicOutlined";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";

const mockPosts = [
  {
    id: 1,
    title: "O-Ring Material Selection: FKM vs FFKM vs Silicone — when to use which",
    date: "2026-04-02",
    status: "Draft",
    engagement: "—",
  },
  {
    id: 2,
    title: "PEEK Machined Components — new product range launch",
    date: "2026-04-05",
    status: "Draft",
    engagement: "—",
  },
  {
    id: 3,
    title: "POM-C Acetal Copolymer: precision parts in food processing",
    date: "2026-04-08",
    status: "Draft",
    engagement: "—",
  },
  {
    id: 4,
    title: "PEEK vs POM-C — engineering plastics comparison",
    date: "2026-03-28",
    status: "Draft",
    engagement: "—",
  },
  {
    id: 5,
    title: "FFKM o-rings for chemical-resistant sealing applications",
    date: "2026-03-20",
    status: "Draft",
    engagement: "—",
  },
];

const statusColor: Record<string, "success" | "warning" | "default"> = {
  Published: "success",
  Scheduled: "warning",
  Draft: "default",
};

export default function LinkedInPage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("EN");
  const [audience, setAudience] = useState("Engineers");
  const [postType, setPostType] = useState("Text Only");

  return (
    <>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            background: "linear-gradient(135deg, #0077B5 0%, #005582 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinkedIn sx={{ color: "#fff", fontSize: 30 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
            LinkedIn Content Manager
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create, schedule &amp; manage LinkedIn posts
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2.5 }} />

      {/* Two-column layout */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Left: Post Composer */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>
                Post Composer
              </Typography>

              <TextField
                label="Topic / Key Message"
                multiline
                rows={5}
                fullWidth
                placeholder="e.g. PTFE vs FKM comparison for high-temperature sealing applications — highlight performance data and cost benefits..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                sx={{ mb: 3 }}
              />

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tone</InputLabel>
                    <Select
                      value={tone}
                      label="Tone"
                      onChange={(e) => setTone(e.target.value)}
                    >
                      <MenuItem value="Professional">Professional</MenuItem>
                      <MenuItem value="Casual">Casual</MenuItem>
                      <MenuItem value="Technical">Technical</MenuItem>
                      <MenuItem value="Inspiring">Inspiring</MenuItem>
                      <MenuItem value="Thought Leadership">Thought Leadership</MenuItem>
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
                    <InputLabel>Post Type</InputLabel>
                    <Select
                      value={postType}
                      label="Post Type"
                      onChange={(e) => setPostType(e.target.value)}
                    >
                      <MenuItem value="Text Only">Text Only</MenuItem>
                      <MenuItem value="Image + Text">Image + Text</MenuItem>
                      <MenuItem value="Carousel">Carousel</MenuItem>
                      <MenuItem value="Video + Text">Video + Text</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box sx={{ display: "flex", gap: 2 }}>
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
                  Generate with AI
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Schedule />}
                  disabled={!topic}
                >
                  Schedule Post
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Post Preview */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>
                Post Preview
              </Typography>

              {/* Mock LinkedIn Post Card */}
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid #e0e0e0",
                  bgcolor: "#fff",
                }}
              >
                {/* Post header */}
                <Box sx={{ p: 2, pb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: "#274e64",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      A+P
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          lineHeight: 1.3,
                          color: "#000",
                        }}
                      >
                        APSOparts
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: "#666",
                          lineHeight: 1.3,
                        }}
                      >
                        Sealings &amp; Plastics &middot; apsoparts.com
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.7rem",
                          color: "#999",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        2h &middot; <PublicOutlined sx={{ fontSize: 12 }} />
                      </Typography>
                    </Box>
                    <IconButton size="small" sx={{ color: "#666" }}>
                      <MoreHorizOutlined fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {/* Post content */}
                <Box sx={{ px: 2, pb: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: "0.85rem",
                      lineHeight: 1.55,
                      color: "#191919",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {`Choosing the right o-ring material for your application? Here's what our engineers recommend:\n\n\u2705 FKM: Excellent heat & chemical resistance up to +200\u00b0C — ideal for fuel, oil & dynamic seals\n\u2705 FFKM: The ultimate chemical resistance — for the most aggressive media and high temperatures up to +325\u00b0C\n\u2705 Silicone: Best low-temperature flexibility (-60\u00b0C) and food-grade compliance\n\nThe right choice depends on temperature, media, pressure, and service life requirements.\n\nOur application engineers help you select the optimal o-ring for your sealing challenge.\n\n#ORings #Sealing #Engineering #FKM #FFKM #APSOparts`}
                  </Typography>
                </Box>

                <Divider />

                {/* Engagement stats */}
                <Box sx={{ px: 2, py: 0.75 }}>
                  <Typography sx={{ fontSize: "0.75rem", color: "#666" }}>
                    12 reactions &middot; 3 comments
                  </Typography>
                </Box>

                <Divider />

                {/* Action buttons */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-around",
                    py: 0.5,
                  }}
                >
                  {[
                    { icon: <ThumbUpAltOutlined sx={{ fontSize: 18 }} />, label: "Like" },
                    { icon: <ChatBubbleOutline sx={{ fontSize: 18 }} />, label: "Comment" },
                    { icon: <RepeatOutlined sx={{ fontSize: 18 }} />, label: "Repost" },
                    { icon: <SendOutlined sx={{ fontSize: 18 }} />, label: "Send" },
                  ].map((action) => (
                    <Button
                      key={action.label}
                      size="small"
                      startIcon={action.icon}
                      sx={{
                        color: "#666",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "none",
                        px: 1,
                        "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              </Paper>

              {/* Brand Tone Check */}
              <Paper
                variant="outlined"
                sx={{
                  mt: 2.5,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(16,185,129,0.04)",
                  borderColor: "rgba(16,185,129,0.3)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 1.5, color: "#274e64" }}
                >
                  Brand Tone Check
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {[
                    { label: "Professional", ok: true },
                    { label: "On-brand", ok: true },
                    { label: "Compliant", ok: true },
                  ].map((check) => (
                    <Box
                      key={check.label}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <CheckCircle
                        sx={{ fontSize: 18, color: "success.main" }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {check.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Posts Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Posts
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Engagement</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockPosts.map((post) => (
                  <TableRow
                    key={post.id}
                    sx={{ "&:last-child td": { borderBottom: 0 } }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          maxWidth: 340,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {post.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {post.date}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={post.status}
                        size="small"
                        color={statusColor[post.status]}
                        variant={post.status === "Draft" ? "outlined" : "filled"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {post.engagement}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" sx={{ color: "text.secondary" }}>
                          <Edit fontSize="small" />
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
        icon={<LinkedIn />}
        sx={{
          borderRadius: 3,
          "& .MuiAlert-icon": { color: "#0077B5" },
        }}
      >
        LinkedIn API integration coming soon. Posts are currently generated as
        drafts for manual publishing.
      </Alert>
    </>
  );
}
