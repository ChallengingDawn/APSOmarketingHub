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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { useRouter } from "next/navigation";

import { APPS } from "@/app/hubApps";
import { useViewAs } from "@/app/ViewAs";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, Kicker, MUTED, glass } from "@/app/uc/report/ui";
import {
  ROLE_LABEL, ROLE_NOTE, effectiveLevel, levelsFor, type Level, type Role,
} from "@/lib/auth/access";

type Person = {
  id: number; username: string; full_name: string; email: string | null;
  role: Role; is_active: boolean; totp_enrolled: boolean;
  last_login: string | null; access: Record<string, Level>;
};

const ROLE_TINT: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: "#efe8fd", fg: "#5a3fa0" },
  user: { bg: "#e6edfd", fg: "#2459d1" },
  viewer: { bg: "#e9eef5", fg: "#4a5a70" },
};

/** One list, so the headings and the cells cannot drift out of step. */
const COLUMNS = [
  { label: "Person", align: "left" as const },
  { label: "Role", align: "left" as const },
  { label: "Status", align: "left" as const },
  { label: "App access", align: "left" as const },
  { label: "Last active", align: "right" as const },
];

const headCell = {
  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase" as const, color: FAINT, whiteSpace: "nowrap" as const,
};

/** Every body cell: same height, same gutters, one hairline. */
const cell = { px: 1.25, py: 1.15, borderBottom: `1px solid ${HAIRLINE}`, verticalAlign: "middle" as const };

/** Enough that a team of twenty is one page, few enough that a long list pages. */
const PAGE_SIZE = 25;

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
  const router = useRouter();
  const { setViewed } = useViewAs();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [me, setMe] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [page, setPage] = useState(0);
  const [remove, setRemove] = useState<{ person: Person; typed: string } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pw, setPw] = useState<{ person: Person; value: string; done: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [invite, setInvite] = useState<{
    fullName: string; username: string; email: string; role: Role;
    how: "self" | "password"; password: string;
    /** Once created and told how to get in: the address they sign in with. */
    createdAs: string | null; busy: boolean;
  } | null>(null);

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

  // Your own id, so the screen can refuse what the server would refuse anyway:
  // nobody changes their own role.
  useEffect(() => {
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.user) setMe(j.user.id as number); })
      .catch(() => {});
  }, []);

  /**
   * Role, suspension, a new password, a cleared second factor — all four go to
   * the endpoint that already knew how to do them, rather than a second copy
   * here that would drift away from its guards.
   */
  const patch = async (
    p: Person,
    body: { role?: Role; isActive?: boolean; resetPassword?: string; resetTotp?: boolean },
    local?: Partial<Person>,
  ) => {
    setSaving(`${p.id}:role`);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) {
        // The status matters: a 403 means the session is not an admin any more,
        // a 400 means the change itself was refused, and "nothing happened" told
        // nobody which.
        setError(`${j?.error ?? "That change was refused."} (HTTP ${r.status})`);
        return false;
      }
      if (local) setPeople((cur) => (cur ?? []).map((x) => (x.id === p.id ? { ...x, ...local } : x)));
      // Read it back rather than trust the optimistic update: if the server
      // stored something other than what was clicked, the screen should show
      // what is really there.
      load();
      setNote("Saved.");
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(null);
    }
  };

  /**
   * A password the admin never invents. Generated here, shown once, and the
   * account is forced to change it at the next sign-in — so a password an admin
   * has seen is only ever good for one login.
   */
  const newPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint32Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (people ?? []).filter((p) =>
      (role === "all" || p.role === role) &&
      (status === "all" || (status === "active" ? p.is_active : !p.is_active)) &&
      (!needle || p.full_name.toLowerCase().includes(needle) ||
        (p.email ?? "").toLowerCase().includes(needle) ||
        p.username.toLowerCase().includes(needle)),
    );
  }, [people, q, role, status]);

  // A page of rows. Narrowing the filter while on page 4 used to show an empty
  // table rather than the two matches, so any change to the filters goes back
  // to the first page.
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const onPage = Math.min(page, pages - 1);
  const rows = visible.slice(onPage * PAGE_SIZE, onPage * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => { setPage(0); }, [q, role, status]);

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
      <Snackbar
        open={!!error || !!note}
        autoHideDuration={error ? 8000 : 2500}
        onClose={() => { setError(null); setNote(null); }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={error ? "error" : "success"} variant="filled"
          onClose={() => { setError(null); setNote(null); }} sx={{ fontSize: "0.86rem" }}>
          {error ?? note}
        </Alert>
      </Snackbar>

      <Box sx={{
        display: "grid", gap: 2.5,
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.9fr) minmax(300px,1fr)" },
        alignItems: "start",
      }}>
        {/* ------------------------------------------------------- the table */}
        <GlassCard>
          {/* Title first, on its own line. The controls used to sit beside it and
              pushed the sentence into two ragged lines on anything narrow. */}
          <CardTitle
            icon={<PeopleIcon />} title="People &amp; access"
            note="Who may open which app. The role sets how far they go; the grant sets where."
            right={
              <Button
                size="small" variant="contained" startIcon={<PersonAddAlt1Icon />}
                onClick={() => setInvite({
                  fullName: "", username: "", email: "", role: "viewer",
                  how: "self", password: newPassword(), createdAs: null, busy: false,
                })}
                sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}
              >
                Add person
              </Button>
            }
          />
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            <TextField size="small" placeholder="Search people…" value={q}
              onChange={(e) => setQ(e.target.value)} sx={{ flex: "1 1 200px", minWidth: 160 }} />
            <Select size="small" value={role} onChange={(e) => setRole(e.target.value as typeof role)}
              sx={{ width: 140, flexShrink: 0 }}>
              <MenuItem value="all">All roles</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">Editor</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
            <Select size="small" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              sx={{ width: 140, flexShrink: 0 }}>
              <MenuItem value="all">Any status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
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
                    {COLUMNS.map((c) => (
                      <Box component="th" key={c.label} sx={{
                        ...headCell, textAlign: c.align, pb: 1, px: 1.25,
                        borderBottom: `1px solid ${HAIRLINE}`,
                      }}>{c.label}</Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {rows.map((p) => (
                    <Box component="tr" key={p.id}
                      onClick={() => setSelected(p.id)}
                      sx={{
                        cursor: "pointer",
                        bgcolor: person?.id === p.id ? "rgba(36,89,209,.07)" : "transparent",
                        "&:hover": { bgcolor: "rgba(36,89,209,.05)" },
                      }}>
                      <Box component="td" sx={{ ...cell }}>
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
                      <Box component="td" sx={{ ...cell }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        {p.id === me ? (
                          <Tooltip title="You cannot change your own role. Ask another admin.">
                            <Chip size="small" label={ROLE_LABEL[p.role]} sx={{
                              height: 22, fontSize: "0.72rem", fontWeight: 700,
                              bgcolor: ROLE_TINT[p.role].bg, color: ROLE_TINT[p.role].fg,
                            }} />
                          </Tooltip>
                        ) : (
                          <Select
                            size="small"
                            value={p.role}
                            disabled={saving === `${p.id}:role`}
                            onChange={(e) => patch(p, { role: e.target.value as Role }, { role: e.target.value as Role })}
                            sx={{
                              minWidth: 104, fontSize: "0.78rem", fontWeight: 700,
                              color: ROLE_TINT[p.role].fg,
                              "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
                              bgcolor: ROLE_TINT[p.role].bg, borderRadius: "999px",
                              "& .MuiSelect-select": { py: 0.35 },
                            }}
                          >
                            {(["admin", "user", "viewer"] as Role[]).map((r) => (
                              <MenuItem key={r} value={r} sx={{ fontSize: "0.85rem" }}>{ROLE_LABEL[r]}</MenuItem>
                            ))}
                          </Select>
                        )}
                      </Box>
                      <Box component="td" sx={{ ...cell, whiteSpace: "nowrap" }}>
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
                      <Box component="td" sx={{ ...cell }}>
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
                        ...cell, textAlign: "right",
                        fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap",
                      }}>{ago(p.last_login)}</Box>
                    </Box>
                  ))}
                  {rows.length === 0 && (
                    <Box component="tr">
                      <Box component="td" colSpan={COLUMNS.length} sx={{ px: 1.25, py: 3, textAlign: "center", color: MUTED, fontSize: "0.88rem" }}>
                        Nobody matches that.
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {people && visible.length > 0 && (
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1.5, pt: 1.5, mt: 0.5,
              borderTop: `1px solid ${HAIRLINE}`, flexWrap: "wrap",
            }}>
              <Typography sx={{ fontSize: "0.78rem", color: FAINT, flex: 1 }}>
                {visible.length === people.length
                  ? `${visible.length} ${visible.length === 1 ? "person" : "people"}`
                  : `${visible.length} of ${people.length}`}
                {pages > 1 ? ` \u00b7 page ${onPage + 1} of ${pages}` : ""}
              </Typography>
              {pages > 1 && (
                <>
                  <Button size="small" disabled={onPage === 0} onClick={() => setPage(onPage - 1)}
                    sx={{ textTransform: "none", color: MUTED, minWidth: 0 }}>Back</Button>
                  <Button size="small" disabled={onPage >= pages - 1} onClick={() => setPage(onPage + 1)}
                    sx={{ textTransform: "none", color: MUTED, minWidth: 0 }}>Next</Button>
                </>
              )}
            </Box>
          )}
        </GlassCard>

        {/* ------------------------------------------------- the one person */}
        {person && (
          <GlassCard sx={{ display: "grid", gap: 2.25, position: { lg: "sticky" }, top: { lg: 16 } }}>
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
              <Kicker>Workspace access</Kicker>

              {person.role === "admin" ? (
                <Typography sx={{ fontSize: "0.85rem", color: MUTED, lineHeight: 1.5 }}>
                  An admin has every app. There is nothing to grant here — change the role if that is not what
                  you meant.
                </Typography>
              ) : (
                <Box sx={{ display: "grid", gap: 1 }}>
                  {APPS.map((a) => (
                    <Box key={a.key} sx={{
                      display: "flex", alignItems: "center", gap: 1.25, minHeight: 40,
                    }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: "8px", flexShrink: 0,
                        background: `linear-gradient(140deg, ${a.from}, ${a.to})`,
                      }} />
                      <Typography sx={{
                        fontSize: "0.85rem", color: INK, flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{a.name}</Typography>
                      <Select
                        size="small"
                        value={person.access[a.key] ?? "none"}
                        disabled={saving === `${person.id}:${a.key}`}
                        onChange={(e) => setLevel(person, a.key, e.target.value as Level)}
                        sx={{ width: 124, flexShrink: 0, fontSize: "0.82rem", borderRadius: "10px" }}
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

            <Box sx={{
              display: "flex", gap: 1, flexWrap: "wrap",
              "& .MuiButton-root": { textTransform: "none", borderRadius: "12px", flexShrink: 0 },
            }}>
              {/* A preview, not a login: it changes what the screens draw, never
                  what the server will do for you. */}
              <Button
                size="small" variant="outlined" startIcon={<VisibilityIcon />}
                onClick={() => {
                  setViewed({ id: person.id, name: person.full_name || person.username, role: person.role, access: person.access });
                  router.push("/");
                }}
                sx={{ textTransform: "none", borderRadius: "12px" }}
              >
                View as {(person.full_name || person.username).split(" ")[0]}
              </Button>
              <Button
                size="small" variant="outlined" startIcon={<KeyOutlinedIcon />}
                disabled={saving === `${person.id}:role`}
                onClick={() => { setPw({ person, value: newPassword(), done: false }); }}
                sx={{ textTransform: "none", borderRadius: "12px" }}
              >
                Reset password
              </Button>
              {person.totp_enrolled && (
                <Button
                  size="small" startIcon={<ShieldOutlinedIcon />}
                  disabled={saving === `${person.id}:role`}
                  onClick={async () => {
                    if (!confirm(`Clear ${person.full_name || person.username}'s second factor? They will enrol a new authenticator at their next sign-in. Only do this if you have spoken to them.`)) return;
                    await patch(person, { resetTotp: true }, { totp_enrolled: false });
                  }}
                  sx={{ textTransform: "none", color: MUTED }}
                >
                  Reset two-factor
                </Button>
              )}
              {person.id !== me && (
                <Button
                  size="small" color="error"
                  disabled={saving === `${person.id}:role`}
                  onClick={() => setRemove({ person, typed: "" })}
                  sx={{ textTransform: "none" }}
                >
                  Delete account
                </Button>
              )}
              {person.id !== me && (
                <Button
                  size="small" color={person.is_active ? "inherit" : "primary"}
                  disabled={saving === `${person.id}:role`}
                  onClick={() => patch(person, { isActive: !person.is_active }, { is_active: !person.is_active })}
                  sx={{ textTransform: "none", color: person.is_active ? MUTED : undefined }}
                >
                  {person.is_active ? "Suspend account" : "Restore account"}
                </Button>
              )}
            </Box>

            <Box sx={{ pt: 1.75, borderTop: `1px solid ${HAIRLINE}` }}>
              <Kicker>Security</Kicker>
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
          </GlassCard>
        )}
      </Box>

      {/* Two ways to start an account, and neither is a link to forward. */}
      <Dialog open={!!invite} onClose={() => setInvite(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
          {invite?.createdAs ? "Account created" : "Add a person"}
        </DialogTitle>
        <DialogContent>
          {invite?.createdAs ? (
            <>
              <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 1.5 }}>
                Tell them to go to the hub and sign in with this address. It will ask them to choose a
                password, because the account has never been signed into — so nobody, including you, ever
                knows it.
              </Typography>
              <Box sx={{
                fontFamily: "ui-monospace, 'IBM Plex Mono', monospace", fontSize: "0.86rem",
                p: 1.5, borderRadius: "12px", bgcolor: "#f3f5f8", border: `1px solid ${HAIRLINE}`,
                wordBreak: "break-all", userSelect: "all",
              }}>{invite.createdAs}</Box>
            </>
          ) : invite ? (
            <Box sx={{ display: "grid", gap: 2, pt: 0.5 }}>
              <TextField size="small" label="Full name" value={invite.fullName}
                onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} autoFocus />
              <TextField size="small" label="Username" value={invite.username}
                onChange={(e) => setInvite({ ...invite, username: e.target.value })}
                helperText="What they type to sign in. Letters, digits, . _ @ + -" />
              <TextField size="small" label="Email" type="email" value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <Select size="small" value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}>
                {(["viewer", "user", "admin"] as Role[]).map((r) => (
                  <MenuItem key={r} value={r} sx={{ fontSize: "0.85rem" }}>{ROLE_LABEL[r]}</MenuItem>
                ))}
              </Select>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: -1 }}>
                {ROLE_NOTE[invite.role]} They start with no apps until you grant some.
              </Typography>

              <RadioGroup value={invite.how}
                onChange={(e) => setInvite({ ...invite, how: e.target.value as "self" | "password" })}>
                <FormControlLabel value="self" control={<Radio size="small" />}
                  label={<Typography sx={{ fontSize: "0.86rem" }}>They choose it the first time they sign in</Typography>} />
                <FormControlLabel value="password" control={<Radio size="small" />}
                  label={<Typography sx={{ fontSize: "0.86rem" }}>Set a password for them now</Typography>} />
              </RadioGroup>

              {invite.how === "password" ? (
                <Box>
                  <Box sx={{
                    fontFamily: "ui-monospace, 'IBM Plex Mono', monospace", fontSize: "0.9rem",
                    p: 1.25, borderRadius: "10px", bgcolor: "#f3f5f8", border: `1px solid ${HAIRLINE}`,
                    wordBreak: "break-all", userSelect: "all",
                  }}>{invite.password}</Box>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1 }}>
                    Generated, shown once, and they must change it at the next sign-in — so a password you have
                    seen is good for exactly one login.
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                  The right choice for an admin: they go to the hub, type this address, and are asked to choose
                  a password. One you have seen is one the audit log cannot tell apart from theirs.
                </Typography>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {invite?.createdAs ? (
            <Button variant="contained" onClick={() => { setInvite(null); load(); }} sx={{ textTransform: "none" }}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setInvite(null)} sx={{ textTransform: "none", color: MUTED }}>Cancel</Button>
              <Button
                variant="contained" sx={{ textTransform: "none" }}
                disabled={!invite?.fullName.trim() || !invite?.username.trim() || invite?.busy}
                onClick={async () => {
                  if (!invite) return;
                  setInvite({ ...invite, busy: true });
                  setError(null);
                  try {
                    const r = await fetch("/api/admin/users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        fullName: invite.fullName.trim(),
                        username: invite.username.trim(),
                        email: invite.email.trim() || undefined,
                        role: invite.role,
                        ...(invite.how === "self"
                          ? { setupByUser: true }
                          : { initialPassword: invite.password }),
                      }),
                    });
                    const j = await r.json();
                    if (!r.ok || j?.error) { setError(`${j?.error ?? "That account could not be created."} (HTTP ${r.status})`); return; }
                    if (invite.how === "self") {
                      // Not a link. The address they sign in with, which is all
                      // they need: the door asks for a password when it sees an
                      // account that has never been used.
                      setInvite({ ...invite, busy: false, createdAs: invite.email.trim() || invite.username.trim() });
                    } else {
                      setInvite(null);
                      setNote("Account created. Give them the password you just saw.");
                      load();
                    }
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setInvite((cur) => (cur ? { ...cur, busy: false } : cur));
                  }
                }}
              >Create account</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* No undo, so it asks for the username rather than for a click. The
          alternative is offered in the same breath, because nine times out of
          ten "delete" means "stop them signing in" and that is suspend. */}
      <Dialog open={!!remove} onClose={() => { if (!saving) setRemove(null); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
          Delete {remove?.person.full_name || remove?.person.username}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 2, lineHeight: 1.55 }}>
            The account goes, and with it their app access and every session they have open. What they did
            stays in the audit log under their name. This cannot be undone.
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK, mb: 2, lineHeight: 1.55 }}>
            If you only want to stop them signing in, <strong>suspend</strong> instead \u2014 it is reversible and
            keeps the account attached to its history.
          </Typography>
          <TextField
            size="small" fullWidth autoFocus
            label={`Type ${remove?.person.username} to confirm`}
            value={remove?.typed ?? ""}
            onChange={(e) => setRemove((cur) => (cur ? { ...cur, typed: e.target.value } : cur))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemove(null)} sx={{ textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button
            variant="contained" color="error" sx={{ textTransform: "none" }}
            disabled={!remove || remove.typed.trim() !== remove.person.username || !!saving}
            onClick={async () => {
              if (!remove) return;
              setSaving(`${remove.person.id}:role`);
              setError(null);
              try {
                const r = await fetch(`/api/admin/users/${remove.person.id}`, { method: "DELETE" });
                const text = await r.text();
                const j = text ? JSON.parse(text) : null;
                if (!r.ok || !j?.ok) {
                  setError(`${j?.error ?? "That account could not be deleted."} (HTTP ${r.status})`);
                  return;
                }
                setRemove(null);
                setSelected(null);
                setNote("Account deleted.");
                load();
              } catch (e) {
                setError(String(e));
              } finally {
                setSaving(null);
              }
            }}
          >
            Delete for good
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shown once. There is no mail from here yet, so the admin hands it over
          themselves — and because it must be changed at the next sign-in, a
          password an admin has seen is good for exactly one login. */}
      <Dialog open={!!pw} onClose={() => setPw(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
          {pw?.done ? "Password set" : `Reset password for ${pw?.person.full_name || pw?.person.username}`}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 1.5 }}>
            {pw?.done
              ? "Give them this once, by a route you trust. They must change it when they sign in, and it will not be shown again."
              : "A password is generated rather than chosen, so nobody picks one they have used elsewhere. Nothing changes until you confirm."}
          </Typography>
          <Box sx={{
            fontFamily: "ui-monospace, 'IBM Plex Mono', monospace", fontSize: "1rem",
            p: 1.5, borderRadius: "12px", bgcolor: "#f3f5f8", border: `1px solid ${HAIRLINE}`,
            wordBreak: "break-all", userSelect: "all",
          }}>{pw?.value}</Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {pw?.done ? (
            <Button onClick={() => setPw(null)} variant="contained" sx={{ textTransform: "none" }}>Done</Button>
          ) : (
            <>
              <Button onClick={() => setPw(null)} sx={{ textTransform: "none", color: MUTED }}>Cancel</Button>
              <Button
                variant="contained" sx={{ textTransform: "none" }}
                onClick={async () => {
                  if (!pw) return;
                  const ok = await patch(pw.person, { resetPassword: pw.value });
                  if (ok) setPw({ ...pw, done: true });
                }}
              >Set this password</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
