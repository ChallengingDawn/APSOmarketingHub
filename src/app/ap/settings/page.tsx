"use client";
// THE ANGST+PFISTER HUB'S SETTINGS (SARCLA 10.11.2026: "settings redirect to apsoparts; ap should have simpler settings
// but still settings"). Its own page under its own bar: your account, then how you sign in - the same cards as the
// APSOparts hub's Settings (settings/you, settings/security), nothing of that hub's workspace. A cross-admin finds the
// way to People & access, which lives in the APSOparts hub's Settings with everyone's access.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/People";

import { HomeBar } from "@/app/HomeBar";
import { INK, MUTED, glass, riseKeyframes } from "@/app/reporting/ui";
import { MyAccount } from "@/app/settings/you/MyAccount";
import Security from "@/app/settings/security/page";
import { asCross, type Cross } from "@/lib/auth/access";

function Heading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <Typography id={id} component="h2" sx={{
      mt: { xs: 2.5, md: 3 }, px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, scrollMarginTop: 16,
      fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
      fontSize: "1.15rem", fontWeight: 600, letterSpacing: "-0.02em", color: INK,
    }}>{children}</Typography>
  );
}

export default function ApSettings() {
  const [cross, setCross] = useState<Cross | null>(null);
  useEffect(() => {
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setCross(asCross(j.cross)); })
      .catch(() => {});
  }, []);

  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar hub="ap" on="Settings" />

      <Typography component="h1" sx={{
        mt: { xs: 2, md: 3 },
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: { xs: "1.45rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK,
        lineHeight: { xs: "30px", md: "34px" },
      }}>Settings</Typography>
      <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.5 }}>Your account, and how you sign in.</Typography>

      <Heading>Your account</Heading>
      <MyAccount securityHref="#security" />

      <Heading id="security">Security</Heading>
      <Security />

      {cross === "admin" && (
        <>
          <Heading>People &amp; access</Heading>
          <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, maxWidth: 820 }}>
            <Box sx={{ ...glass, borderRadius: "18px", p: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <PeopleIcon sx={{ fontSize: 20, color: MUTED }} />
              <Typography sx={{ fontSize: "0.88rem", color: INK, flex: 1, minWidth: 0 }}>
                Who may open what - and who is a cross-user or a cross-admin - is set with everyone&apos;s access, in the
                APSOparts hub&apos;s Settings.
              </Typography>
              <Button component={Link} href="/settings/people" size="small" variant="outlined"
                sx={{ textTransform: "none", borderRadius: "12px" }}>
                Open People &amp; access
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
