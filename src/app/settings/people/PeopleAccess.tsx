"use client";
// PEOPLE & ACCESS.
//
// The one screen where access is given, so it is the one place to look when
// somebody asks why they cannot see something: people down the side, apps
// across, a dropdown in the cell.
//
// Everything here is real. The accounts come out of apsomh_users and the grants
// out of apsomh_user_app_access; changing a dropdown writes the row and records
// it in the audit log. Nothing on this screen is illustrative.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/People";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { APPS } from "@/app/hubApps";
import {
  ROLE_LABEL, ROLE_NOTE, effectiveLevel, levelsFor, type Level, type Role,
} from "@/lib/auth/access";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

type Person = {
  id: number; username: string; full_name: string; email: string | null;
  role: Role; is_active: boolean; totp_enrolled: boolean;
  last_login: string | null; access: Record<string, Level>;
};

const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

const ROLE_TINT: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: "#efe8fd", fg: "#5a3fa0" },
  user: { bg: "#e6edfd", fg: "#2459d1" },
  viewer: { bg: "#e9eef5", fg: "#4a5a70" },
};

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

function ago(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export default function PeopleAccess() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/people")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setPeople(j.people as Person[]);
        else setError(j?.error ?? "Could not read the people.");
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (people ?? []).filter((p) =>
      (role === "all" || p.role === role) &&
      (!needle || p.full_name.toLowerCase().includes(needle) ||
        (p.email ?? "").toLowerCase().includes(needle) ||
        p.username.toLowerCase().includes(needle)),
    );
  }, [people, q, role]);

  const person = (people ?? []).find((p) => p.id === selected) ?? visible[0] ?? null;

  const setLevel = async (p: Person, appKey: string, level: Level) => {
    setSaving(`${p.id}:${appKey}`);
    setError(null);
    try {
      const r = await fetch("/api/admin/people", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id, appKey, level }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That change was refused."); return; }
      setPeople((cur) => (cur ?? []).map((x) => x.id === p.id
        ? { ...x, access: level === "none"
            ? Object.fromEntries(Object.entries(x.access).filter(([k]) => k !== appKey))
            : { ...x.access, [appKey]: level } }
        : x));
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5 }}>
      {error && (
        <Box sx={{ ...glass, borderRadius: "16px", p: 2, borderLeft: "3px solid #9e1b18" }}>
          <Typography sx={{ fontSize: "0.88rem", color: "#9e1b18" }}>{error}</Typography>
        </Box>
      )}

      <Box sx={{
        display: "grid", gap: 2.5,
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.9fr) minmax(300px,1fr)" },
        alignItems: "start",
      }}>
        {/* ------------------------------------------------------- the table */}
        <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: "12px", display: "grid", placeItems: "center",
              bgcolor: "#e6edfd", color: "#2459d1", flexShrink: 0,
            }}><PeopleIcon sx={{ fontSize: 21 }} /></Box>
            <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
                People &amp; access
              </Typography>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                Who may open which app. The role sets how far they go; the grant sets where.
              </Typography>
            </Box>
            <TextField size="small" placeholder="Search people…" value={q}
              onChange={(e) => setQ(e.target.value)} sx={{ width: 180 }} />
            <Select size="small" value={role} onChange={(e) => setRole(e.target.value as typeof role)} sx={{ width: 130 }}>
              <MenuItem value="all">All roles</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">Editor</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          </Box>

          {!people && !error && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: MUTED, py: 3 }}>
              <CircularProgress size={18} /> <Typography sx={{ fontSize: "0.9rem" }}>Reading the accounts…</Typography>
            </Box>
          )}

          {people && (
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <Box component="thead">
                  <Box component="tr">
                    {["Person", "Role", "Status", "App access", "Last active"].map((h) => (
                      <Box component="th" key={h} sx={{
                        textAlign: "left", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", color: FAINT, pb: 1, px: 1, whiteSpace: "nowrap",
                        borderBottom: `1px solid ${HAIRLINE}`,
                      }}>{h}</Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {visible.map((p) => (
                    <Box component="tr" key={p.id}
                      onClick={() => setSelected(p.id)}
                      sx={{
                        cursor: "pointer",
                        bgcolor: person?.id === p.id ? "rgba(36,89,209,.07)" : "transparent",
                        "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
                      }}>
                      <Box component="td" sx={{ px: 1, py: 1.25, borderBottom: `1px solid ${HAIRLINE}` }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                          <Box sx={{
                            width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                            bgcolor: ROLE_TINT[p.role].bg, color: ROLE_TINT[p.role].fg,
                            fontSize: "0.72rem", fontWeight: 700,
                          }}>{initials(p.full_name || p.username)}</Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: "0.87rem", fontWeight: 600, color: INK, lineHeight: 1.25 }}>
                              {p.full_name || p.username}
                            </Typography>
                            <Typography sx={{ fontSize: "0.74rem", color: FAINT, lineHeight: 1.25 }}>
                              {p.email || p.username}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box component="td" sx={{ px: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
                        <Tooltip title={ROLE_NOTE[p.role]}>
                          <Chip size="small" label={ROLE_LABEL[p.role]} sx={{
                            height: 22, fontSize: "0.72rem", fontWeight: 700,
                            bgcolor: ROLE_TINT[p.role].bg, color: ROLE_TINT[p.role].fg,
                          }} />
                        </Tooltip>
                      </Box>
                      <Box component="td" sx={{ px: 1, borderBottom: `1px solid ${HAIRLINE}`, whiteSpace: "nowrap" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box sx={{
                            width: 8, height: 8, borderRadius: "50%",
                            bgcolor: p.is_active ? "#1e7e45" : "#c5221f",
                          }} />
                          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                            {p.is_active ? "Active" : "Suspended"}
                          </Typography>
                        </Box>
                      </Box>
                      <Box component="td" sx={{ px: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {APPS.map((a) => {
                            const lvl = effectiveLevel(p.role, p.access[a.key]);
                            const on = lvl !== "none";
                            return (
                              <Tooltip key={a.key} title={`${a.name} · ${on ? (lvl === "write" ? "Edit" : "View") : "No access"}`}>
                                <Box sx={{
                                  width: 22, height: 22, borderRadius: "7px",
                                  background: on ? `linear-gradient(140deg, ${a.from}, ${a.to})` : "rgba(21,34,58,.07)",
                                  opacity: on ? 1 : 0.9,
                                }} />
                              </Tooltip>
                            );
                          })}
                        </Box>
                      </Box>
                      <Box component="td" sx={{
                        px: 1, borderBottom: `1px solid ${HAIRLINE}`,
                        fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap",
                      }}>{ago(p.last_login)}</Box>
                    </Box>
                  ))}
                  {visible.length === 0 && (
                    <Box component="tr">
                      <Box component="td" colSpan={5} sx={{ px: 1, py: 3, textAlign: "center", color: MUTED, fontSize: "0.88rem" }}>
                        Nobody matches that.
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* ------------------------------------------------- the one person */}
        {person && (
          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 }, display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center",
                bgcolor: ROLE_TINT[person.role].bg, color: ROLE_TINT[person.role].fg,
                fontSize: "0.9rem", fontWeight: 700, flexShrink: 0,
              }}>{initials(person.full_name || person.username)}</Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.015em" }}>
                  {person.full_name || person.username}
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{person.email || person.username}</Typography>
              </Box>
              <Chip size="small" label={ROLE_LABEL[person.role]} sx={{
                height: 22, fontSize: "0.72rem", fontWeight: 700,
                bgcolor: ROLE_TINT[person.role].bg, color: ROLE_TINT[person.role].fg,
              }} />
            </Box>

            <Box>
              <Typography sx={{
                fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: FAINT, mb: 1,
              }}>Workspace access</Typography>

              {person.role === "admin" ? (
                <Typography sx={{ fontSize: "0.85rem", color: MUTED, lineHeight: 1.5 }}>
                  An admin has every app. There is nothing to grant here — change the role if that is not what
                  you meant.
                </Typography>
              ) : (
                <Box sx={{ display: "grid", gap: 1 }}>
                  {APPS.map((a) => (
                    <Box key={a.key} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: "8px", flexShrink: 0,
                        background: `linear-gradient(140deg, ${a.from}, ${a.to})`,
                      }} />
                      <Typography sx={{ fontSize: "0.85rem", color: INK, flex: 1, minWidth: 0 }}>{a.name}</Typography>
                      <Select
                        size="small"
                        value={person.access[a.key] ?? "none"}
                        disabled={saving === `${person.id}:${a.key}`}
                        onChange={(e) => setLevel(person, a.key, e.target.value as Level)}
                        sx={{ width: 118, fontSize: "0.82rem" }}
                      >
                        {levelsFor(person.role).map((l) => (
                          <MenuItem key={l.value} value={l.value} sx={{ fontSize: "0.85rem" }}>{l.label}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{
                fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: FAINT, mb: 1,
              }}>Security</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {person.totp_enrolled
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: "#1e7e45" }} />
                  : <ShieldOutlinedIcon sx={{ fontSize: 18, color: "#b26a00" }} />}
                <Typography sx={{ fontSize: "0.85rem", color: INK, flex: 1 }}>Two-factor authentication</Typography>
                <Typography sx={{
                  fontSize: "0.78rem", fontWeight: 600,
                  color: person.totp_enrolled ? "#1e7e45" : "#b26a00",
                }}>{person.totp_enrolled ? "Enabled" : "Off"}</Typography>
              </Box>
              {!person.totp_enrolled && person.role !== "viewer" && (
                <Typography sx={{ fontSize: "0.78rem", color: "#b26a00", mt: 0.75, lineHeight: 1.45 }}>
                  This role can change things, so it should carry a second factor. They enrol it themselves at
                  the next sign-in; it cannot be set for them.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* What is real and what is not, said once rather than implied. */}
      <Box sx={{ ...glass, borderRadius: "16px", p: 2, borderLeft: "3px solid #b26a00" }}>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>Grants here are real and take effect immediately</strong> — the row is
          written and the change is recorded in the audit log. What is <em>not</em> built yet: the guards inside
          each app do not read these grants, so an app still opens for anyone signed in. Inviting people, roles
          changed from this screen, and suspending an account are also still to come.
        </Typography>
      </Box>
    </Box>
  );
}
