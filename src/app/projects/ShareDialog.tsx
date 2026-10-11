"use client";
// SHARE A PROJECT - the Adobe Express way (SARCLA, 11.10.2026): name people,
// say whether they can edit or only comment, add a message, send. Each person
// gets the hub's invitation email from you (Settings > Mail shows it), and a
// reply comes back to you. Below: everyone with access, the owner first.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import CloseIcon from "@mui/icons-material/Close";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { FAINT, HAIRLINE, INK, MUTED, RED, GREEN } from "@/app/uc/report/ui";

type Person = { username: string; name: string; email: string | null };
type Member = Person & { role: "owner" | "editor" | "commenter"; invitedBy: string | null; invitedAt: string | null; message: string | null; mailedAt: string | null; mailError: string | null };
type Access = { role: string; canEdit: boolean; canComment: boolean; canShare: boolean };

const ROLE_LABEL = { editor: "Can edit", commenter: "Can comment" } as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Initials on a colour picked from the name, so the same person is always the same circle. */
export function Face({ name, size = 30 }: { name: string; size?: number }) {
  const palette = ["#5b6ef5", "#1b7a55", "#b63a76", "#a96a12", "#2459d1", "#6a46c9", "#13866a"];
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <Box title={name} sx={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
      bgcolor: palette[h % palette.length], color: "#fff", fontSize: size * 0.38, fontWeight: 700, border: "2px solid #fff",
    }}>{initials}</Box>
  );
}

export default function ShareDialog({ projectId, title, open, onClose, onChanged, me }: {
  projectId: number; title: string; open: boolean; onClose: () => void; onChanged: () => void; me: string | null;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [access, setAccess] = useState<Access | null>(null);
  const [mailReady, setMailReady] = useState(true);
  const [picked, setPicked] = useState<Person[]>([]);
  const [role, setRole] = useState<"editor" | "commenter">("editor");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; m: Member } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/content/projects/${projectId}/share`).then((r) => r.json()).then((j) => {
      if (!j.ok) { setNote({ tone: "bad", text: j.error ?? "Could not read who is in this project." }); return; }
      setMembers(j.members); setCandidates(j.candidates); setAccess(j.access); setMailReady(j.mailReady);
    }).catch(() => setNote({ tone: "bad", text: "Could not read who is in this project." }));
  }, [projectId]);
  useEffect(() => { if (open) { setNote(null); load(); } }, [open, load]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const j = await fetch(`/api/content/projects/${projectId}/share`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!j.ok) { setNote({ tone: "bad", text: j.error ?? "That did not work." }); return null; }
      if (j.members) setMembers(j.members);
      onChanged();
      return j;
    } finally { setBusy(false); }
  };

  const invite = async () => {
    const j = await post({ action: "invite", usernames: picked.map((p) => p.username), role, message });
    if (!j) return;
    const res = (j.results ?? []) as { username: string; mailed: boolean; error?: string }[];
    const failed = res.filter((r) => !r.mailed);
    setNote(failed.length
      ? { tone: "bad", text: `Shared. The email did not reach ${failed.map((f) => f.username).join(", ")}: ${failed[0].error}` }
      : { tone: "ok", text: `Shared with ${res.length} ${res.length === 1 ? "person" : "people"} - the hub emailed ${res.length === 1 ? "them" : "each of them"}.` });
    setPicked([]); setMessage("");
  };

  const inProject = new Set(members.map((m) => m.username));
  const options = candidates.filter((c) => !inProject.has(c.username));
  const canShare = !!access?.canShare;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "20px" } }}>
      <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>Share project</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close" size="small"><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {canShare && (
          <Box sx={{ display: "grid", gap: 1.25, mb: 2.5 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Autocomplete
                multiple fullWidth size="small" options={options} value={picked}
                onChange={(_, v) => setPicked(v)}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(a, b) => a.username === b.username}
                filterOptions={(opts, s) => {
                  const q = s.inputValue.trim().toLowerCase();
                  return q ? opts.filter((o) => `${o.name} ${o.email ?? ""} ${o.username}`.toLowerCase().includes(q)) : opts;
                }}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o.username} sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
                    <Face name={o.name} size={26} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", color: INK }}>{o.name}</Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{o.email ?? "no email address"}</Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(p) => <TextField {...p} placeholder={picked.length ? "" : "Add a name or email"} />}
                noOptionsText="Nobody else with Marketing & Content access"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />
              <Select size="small" value={role} onChange={(e) => setRole(e.target.value as "editor" | "commenter")}
                sx={{ borderRadius: "10px", fontSize: 13.5, minWidth: 138 }}>
                <MenuItem value="editor">Can edit</MenuItem>
                <MenuItem value="commenter">Can comment</MenuItem>
              </Select>
            </Box>
            <TextField
              size="small" multiline minRows={2} maxRows={6} placeholder="Add a message (optional)"
              value={message} onChange={(e) => setMessage(e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: 13.5 } }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography sx={{ flex: 1, minWidth: 200, fontSize: "0.76rem", color: mailReady ? FAINT : RED, display: "flex", gap: 0.5, alignItems: "center" }}>
                <MailOutlineIcon sx={{ fontSize: 15 }} />
                {mailReady
                  ? <>The hub emails each person, from you; replies come back to you. <Link href="/settings/mail" style={{ color: MUTED }}>See the email</Link></>
                  : "The hub's mail relay is not set up: they will see the project, but get no email."}
              </Typography>
              <Button variant="contained" disableElevation disabled={busy || !picked.length} onClick={invite}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
                {busy ? "Sending…" : "Send invite"}
              </Button>
            </Box>
          </Box>
        )}

        {note && (
          <Typography sx={{ fontSize: "0.82rem", color: note.tone === "ok" ? GREEN : RED, mb: 1.5 }}>{note.text}</Typography>
        )}

        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
          People with access
        </Typography>
        {members.map((m) => (
          <Box key={m.username} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1, borderTop: `1px solid ${HAIRLINE}` }}>
            <Face name={m.name} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.88rem", color: INK, fontWeight: 600 }}>
                {m.name}{m.username === me ? " (you)" : ""}
              </Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.email ?? m.username}
                {m.role !== "owner" && m.mailedAt && ` · emailed ${when(m.mailedAt)}`}
              </Typography>
              {m.role !== "owner" && m.mailError && (
                <Typography sx={{ fontSize: "0.74rem", color: RED, display: "flex", gap: 0.4, alignItems: "center" }}>
                  <ErrorOutlineIcon sx={{ fontSize: 14 }} /> Email not sent: {m.mailError}
                </Typography>
              )}
            </Box>
            {m.role === "owner" ? (
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, fontWeight: 600, pr: 1 }}>Owner</Typography>
            ) : canShare ? (
              <>
                <Select size="small" value={m.role} disabled={busy}
                  onChange={(e) => post({ action: "role", username: m.username, role: e.target.value })}
                  sx={{ borderRadius: "10px", fontSize: 13, minWidth: 128 }}>
                  <MenuItem value="editor">{ROLE_LABEL.editor}</MenuItem>
                  <MenuItem value="commenter">{ROLE_LABEL.commenter}</MenuItem>
                </Select>
                <IconButton size="small" aria-label={`More for ${m.name}`} onClick={(e) => setMenu({ el: e.currentTarget, m })}>
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{ROLE_LABEL[m.role]}</Typography>
                {m.username === me && (
                  <Button size="small" disabled={busy} onClick={async () => { if (await post({ action: "remove", username: m.username })) onClose(); }}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", color: RED }}>Leave</Button>
                )}
              </Box>
            )}
          </Box>
        ))}

        <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
          {menu?.m.mailError && (
            <MenuItem onClick={() => { const m = menu.m; setMenu(null); post({ action: "resend", usernames: [m.username], role: m.role, message: m.message }); }}>
              Send the email again
            </MenuItem>
          )}
          {(access?.role === "owner" || access?.role === "admin") && (
            <MenuItem onClick={() => { const m = menu!.m; setMenu(null); post({ action: "owner", username: m.username }); }}>
              Make owner
            </MenuItem>
          )}
          <MenuItem sx={{ color: RED }} onClick={() => { const m = menu!.m; setMenu(null); post({ action: "remove", username: m.username }); }}>
            Remove from project
          </MenuItem>
        </Menu>
      </DialogContent>
    </Dialog>
  );
}
