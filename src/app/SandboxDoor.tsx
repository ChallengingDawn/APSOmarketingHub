"use client";
// WHAT A SANDBOX COPY SHOWS INSTEAD OF A SIGN-IN - it has no password and no TOTP of its own: it opens from the hub's
// Sandbox app, behind the hub's sign-in (src/lib/sandbox/door.ts). Same card as every other door of the hub.

import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { AuthShell, MUTED } from "./AuthShell";

export default function SandboxDoor({ hub }: { hub: string | null }) {
  return (
    <AuthShell>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, mb: 1 }}>This sandbox opens from the hub</Typography>
      <Typography sx={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.5, mb: 2.5 }}>
        Sign in to the hub and open your sandbox from its Sandbox app - there is no separate password here.
      </Typography>
      {hub && <Button variant="contained" disableElevation href={hub} fullWidth>Go to the hub</Button>}
    </AuthShell>
  );
}
