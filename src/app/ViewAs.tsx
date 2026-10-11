"use client";
// VIEW AS — see the hub the way somebody else sees it.
//
// A PREVIEW, not an impersonation, and the difference matters. It changes what
// the screens DRAW: which apps appear, which are locked. It does not change what
// the server will do for you — you are still signed in as yourself, and every
// API still answers to your own role. So it can hide things and never reveal
// them, which makes it safe to leave in the hands of any admin.
//
// Two consequences worth being honest about on the banner: a preview cannot
// prove somebody is locked OUT of something (the guards do not read grants yet),
// and anything you click while previewing you do with your own permissions.
//
// Kept in this browser only. It is a lens you hold, not a state of the account.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { effectiveLevel, type Level, type Role } from "@/lib/auth/access";

const KEY = "apsohub:view-as";

export type Viewed = { id: number; name: string; role: Role; access: Record<string, Level> };

type Ctx = {
  viewed: Viewed | null;
  /** How the hub should behave for the person you are previewing — or for you. */
  roleInView: Role | null;
  canOpen: (appKey: string) => boolean;
  setViewed: (v: Viewed | null) => void;
};

const ViewAsContext = createContext<Ctx>({
  viewed: null, roleInView: null, canOpen: () => true, setViewed: () => {},
});

export function useViewAs() {
  return useContext(ViewAsContext);
}

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [viewed, setViewedState] = useState<Viewed | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setViewedState(JSON.parse(raw) as Viewed);
    } catch { /* a preview that cannot be restored is simply not active */ }
  }, []);

  const setViewed = useCallback((v: Viewed | null) => {
    setViewedState(v);
    try {
      if (v) sessionStorage.setItem(KEY, JSON.stringify(v));
      else sessionStorage.removeItem(KEY);
    } catch { /* it still applies for this page */ }
  }, []);

  const value = useMemo<Ctx>(() => ({
    viewed,
    roleInView: viewed?.role ?? null,
    canOpen: (appKey: string) =>
      !viewed || effectiveLevel(viewed.role, viewed.access[appKey]) !== "none",
    setViewed,
  }), [viewed, setViewed]);

  return (
    <ViewAsContext.Provider value={value}>
      <ViewAsBanner />
      {children}
    </ViewAsContext.Provider>
  );
}

/**
 * Loud on purpose. Somebody who forgets they are previewing will report a bug
 * about apps that vanished, and the fix is that the banner was impossible to
 * miss rather than that they should have remembered.
 */
function ViewAsBanner() {
  const { viewed, setViewed } = useViewAs();
  if (!viewed) return null;
  return (
    <Box sx={{
      position: "sticky", top: 0, zIndex: 1300,
      display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
      px: { xs: 2, md: 3 }, py: 1.15,
      bgcolor: "#3b2d6b", color: "#fff",
      boxShadow: "0 2px 12px rgba(31,45,78,.22)",
    }}>
      <VisibilityIcon sx={{ fontSize: 19 }} />
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>
        Viewing as {viewed.name}
      </Typography>
      <Typography sx={{ fontSize: "0.8rem", opacity: 0.84, flex: "1 1 320px", minWidth: 0 }}>
        You are seeing the apps they would see. You are still signed in as yourself, so anything you do here
        you do with your own permissions.
      </Typography>
      <Button size="small" variant="contained" onClick={() => setViewed(null)}
        sx={{
          textTransform: "none", borderRadius: "10px", bgcolor: "#fff", color: "#3b2d6b", flexShrink: 0,
          "&:hover": { bgcolor: "#efeaff" },
        }}>
        Stop
      </Button>
    </Box>
  );
}
