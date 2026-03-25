"use client";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import SettingsIcon from "@mui/icons-material/Settings";

export default function SettingsPage() {
  return (
    <>
      <Typography variant="h5" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure API keys, brand voice, and generation preferences
      </Typography>

      <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
        <Box sx={{ color: "text.secondary", mb: 2 }}>
          <SettingsIcon sx={{ fontSize: 48, opacity: 0.4 }} />
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Settings coming soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your API keys, default tone of voice, and content generation preferences.
        </Typography>
      </Paper>
    </>
  );
}
