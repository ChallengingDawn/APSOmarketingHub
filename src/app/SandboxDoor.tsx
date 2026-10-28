"use client";
// WHAT A SANDBOX SHOWS INSTEAD OF A SIGN-IN - it has no password and no TOTP: it runs on the person's own computer, for
// them (src/lib/sandbox/door.ts). Same card as every other door of the hub.

import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { AuthShell, MUTED } from "./AuthShell";

export default function SandboxDoor() {
  return (
    <AuthShell>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, mb: 1 }}>No sign-in in the sandbox</Typography>
      <Typography sx={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.5, mb: 2.5 }}>
        It runs on your computer, for you - there is nothing to sign in to.
      </Typography>
      <Button variant="contained" disableElevation href="/" fullWidth>Open the sandbox</Button>
    </AuthShell>
  );
}
