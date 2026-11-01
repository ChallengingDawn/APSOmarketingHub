"use client";
// A SUB-APP THAT IS NOT YOURS, REACHED FROM INSIDE ITS APP.
//
// Each app's layout guards it on the server (requireApp, src/lib/auth/appAccess.ts) - with the sub-app's own rule,
// since the middleware tells it the address. But a layout is drawn once per app: a click from one sub-app to another
// inside the same app does not run it again. So the shell asks the same question on every move, from the same tree
// (src/lib/auth/tree.ts), and says so instead of drawing the page. The page's data stays behind its API's guard
// either way; this is so nobody is left looking at an empty page wondering why.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { Level } from "@/lib/auth/access";
import { accessAt, nodeFor } from "@/lib/auth/tree";
import { appForPath } from "@/lib/auth/access";

export default function PathGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [levels, setLevels] = useState<Record<string, Level> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok && j.levels) setLevels(j.levels as Record<string, Level>); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // while the answer is on its way, and when it could not be read, the page draws - its guards still hold
  if (!levels) return <>{children}</>;
  const a = accessAt(pathname, levels);
  if (a.specific === null || a.level !== "none") return <>{children}</>;

  const app = appForPath(pathname);
  const name = (app && nodeFor(app, pathname)?.name) || "this page";
  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 }, maxWidth: 560 }}>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: "#15223a" }}>{name} is not open to you</Typography>
      <Typography sx={{ fontSize: "0.9rem", color: "#5d6b85", mt: 1 }}>
        Your access does not include it. An admin can give it to you in Settings, People.
      </Typography>
      <Typography component={Link} href="/" sx={{ display: "inline-block", mt: 2, fontSize: "0.9rem", fontWeight: 600, color: "#3461c9", textDecoration: "none" }}>
        Back to the apps
      </Typography>
    </Box>
  );
}
