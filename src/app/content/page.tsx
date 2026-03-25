"use client";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import FolderIcon from "@mui/icons-material/Folder";

export default function ContentBasePage() {
  return (
    <>
      <Typography variant="h5" gutterBottom>
        Content Base
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage reusable content blocks, templates, and brand assets
      </Typography>

      <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
        <Box sx={{ color: "text.secondary", mb: 2 }}>
          <FolderIcon sx={{ fontSize: 48, opacity: 0.4 }} />
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Content Base coming soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload and manage product descriptions, boilerplate text, and brand guidelines.
        </Typography>
      </Paper>
    </>
  );
}
