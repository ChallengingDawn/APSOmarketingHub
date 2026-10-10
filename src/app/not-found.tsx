// THE PAGE THAT ISN'T THERE.
//
// Next ships a default: black "404", "This page could not be found", nothing
// else. It renders inside the hub's shell, so it used to arrive wearing the
// sidebar's no-app fallback — the entire app catalogue laid open beside a dead
// address, which reads as a wrong and much older version of the hub. The
// sidebar now withholds itself for an address that belongs nowhere, and this
// is what fills the space instead.
//
// It says the one thing a 404 can usefully say: the address, so you can see
// the typo yourself.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export default function NotFound() {
  const pathname = usePathname();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
      }}
    >
      <Box sx={{ maxWidth: 560, textAlign: "center" }}>
        <Typography
          sx={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.14em", color: FAINT, mb: 1.5 }}
        >
          NOT FOUND
        </Typography>

        <Typography sx={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1.15, mb: 1.5 }}>
          There is no page at this address
        </Typography>

        {pathname && (
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: "0.82rem",
              color: MUTED,
              bgcolor: "rgba(21,34,58,.05)",
              borderRadius: "10px",
              px: 1.5,
              py: 1,
              mb: 2.5,
              wordBreak: "break-all",
            }}
          >
            {pathname}
          </Typography>
        )}

        <Typography sx={{ fontSize: "0.92rem", color: MUTED, lineHeight: 1.65, mb: 3 }}>
          Either the address has a typo in it, or it pointed at something that has since moved.
          Nothing is broken — the hub simply has no page here.
        </Typography>

        <Button
          component={Link}
          href="/"
          variant="contained"
          sx={{ textTransform: "none", borderRadius: "12px", px: 3, py: 1, fontWeight: 600 }}
        >
          Back to the apps
        </Button>
      </Box>
    </Box>
  );
}
