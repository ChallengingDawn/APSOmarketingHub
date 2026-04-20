"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ConstructionIcon from "@mui/icons-material/Construction";

function storageKey(path: string) {
  return `apso:phase2-acknowledged:${path}`;
}

export default function Phase2Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [ready, setReady] = useState(false);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    try {
      const v = window.sessionStorage.getItem(storageKey(pathname));
      setAck(v === "1");
    } catch {
      setAck(false);
    }
    setReady(true);
  }, [pathname]);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(storageKey(pathname), "1");
    } catch {
      // silent
    }
    setAck(true);
  };

  if (!ready) {
    return <Box sx={{ minHeight: "100vh", bgcolor: "#ffffff" }} />;
  }

  if (ack) return <>{children}</>;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        bgcolor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          bgcolor: "#e8f0f4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <ConstructionIcon sx={{ fontSize: 36, color: "#274e64" }} />
      </Box>
      <Typography
        sx={{
          fontSize: 32,
          fontWeight: 700,
          color: "#1a3a4c",
          letterSpacing: "-0.01em",
          mb: 1,
        }}
      >
        Planned for Phase 2
      </Typography>
      <Typography
        sx={{
          fontSize: 15,
          color: "#5f6368",
          maxWidth: 520,
          mb: 3,
          lineHeight: 1.55,
        }}
      >
        This area isn't connected yet. You can explore it, but everything you see is sample data —
        nothing syncs to HubSpot, Magento, GA4 or LinkedIn until Phase 2.
      </Typography>
      <Button
        onClick={dismiss}
        variant="contained"
        sx={{
          bgcolor: "#ed1b2f",
          textTransform: "none",
          fontWeight: 600,
          px: 3,
          py: 1,
          "&:hover": { bgcolor: "#c91528" },
        }}
      >
        Explore anyway (sample data)
      </Button>
    </Box>
  );
}
