"use client";
// MY ACCOUNT — your picture, your name, how to reach you.
//
// Security lives next door at /settings/security; this is who you are, not how
// you get in. A photo is downscaled in the browser to a 256px square before it
// is sent, so what is stored is a thumbnail rather than whatever came off a
// phone, and it travels with your account rather than this browser.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

import { ROLE_LABEL, ROLE_NOTE, type Role } from "@/lib/auth/access";
import { ICON_CHOICES, drawIcon } from "./avatarIcons";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

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

type Me = {
  username: string; email: string | null; full_name: string;
  role: Role; totp_enrolled: boolean; last_login: string | null;
};

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/**
 * Square, 256px, re-encoded as JPEG.
 *
 * Done here rather than on the server so a 6MB phone photo never travels, and
 * so what lands in the database is a predictable size whatever was chosen.
 */
async function toThumbnail(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file could not be read as an image."));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot resize the picture.");
    // Centre crop, so a portrait is not squashed into a square.
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
      <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>{title}</Typography>
      {note && <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.25, mb: 2 }}>{note}</Typography>}
      {!note && <Box sx={{ height: 14 }} />}
      {children}
    </Box>
  );
}

export default function MyAccount() {
  const [me, setMe] = useState<Me | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("You are not signed in."))))
      .then((j) => {
        const u = j.user as Me;
        setMe(u); setName(u.full_name ?? ""); setEmail(u.email ?? "");
      })
      .catch((e) => setError(String((e as Error).message ?? e)));
    fetch("/api/me/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok && j.prefs?.avatar) setAvatar(j.prefs.avatar); })
      .catch(() => {});
  }, []);

  const saveAvatar = useCallback(async (value: string | null) => {
    setBusy(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/me/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // An empty string clears it; the field is optional, so omitting it would
        // merge to "unchanged" rather than "removed".
        body: JSON.stringify(value === null ? { avatar: undefined } : { avatar: value }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That picture could not be saved."); return; }
      setAvatar(value);
      setNote(value ? "Picture saved." : "Picture removed.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      await saveAvatar(await toThumbnail(f));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  const saveProfile = async () => {
    setBusy(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, email }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That could not be saved."); return; }
      setMe((cur) => (cur ? { ...cur, full_name: name, email: email || null } : cur));
      setNote("Saved.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const changed = !!me && (name.trim() !== (me.full_name ?? "") || email.trim() !== (me.email ?? ""));

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 820 }}>
      {error && <Typography sx={{ color: "#9e1b18", fontSize: "0.9rem" }}>{error}</Typography>}
      {note && <Typography sx={{ color: "#0f7b4f", fontSize: "0.9rem" }}>{note}</Typography>}

      {!me && !error && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: MUTED }}>
          <CircularProgress size={18} /> <Typography sx={{ fontSize: "0.9rem" }}>Reading your account…</Typography>
        </Box>
      )}

      {me && (
        <>
          <Card title="Your picture" note="Shown beside your name here and in the header. Yours to change.">
            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
              <Box sx={{
                width: 84, height: 84, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                display: "grid", placeItems: "center",
                bgcolor: ROLE_TINT[me.role].bg, color: ROLE_TINT[me.role].fg,
                fontSize: "1.6rem", fontWeight: 700,
              }}>
                {avatar
                  ? <Box component="img" src={avatar} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials(me.full_name || me.username)}
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} disabled={busy}
                  onClick={() => file.current?.click()} sx={{ textTransform: "none", borderRadius: "12px" }}>
                  {avatar ? "Change picture" : "Upload a picture"}
                </Button>
                {avatar && (
                  <Button size="small" color="inherit" startIcon={<DeleteOutlineIcon />} disabled={busy}
                    onClick={() => saveAvatar(null)} sx={{ textTransform: "none", color: MUTED }}>
                    Remove
                  </Button>
                )}
                <Box component="input" ref={file} type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0])}
                  sx={{ display: "none" }} />
                <Typography sx={{ fontSize: "0.76rem", color: FAINT, width: "100%" }}>
                  Cropped square and resized to 256px before it leaves this browser.
                </Typography>
              </Box>
            </Box>

            {/* Nobody uploads a photograph of themselves to an internal tool, so
                the realistic alternative to a picture is two grey initials. A
                dozen icons costs nothing and gives the hub some faces. They are
                drawn here into the same square an upload is resized to, so
                everywhere that shows a picture shows these too. */}
            <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, mb: 0.25 }}>
                Or pick one
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1.5 }}>
                No upload, no photo of you. Change it as often as you like.
              </Typography>
              <Box sx={{ display: "flex", gap: 1.1, flexWrap: "wrap" }}>
                {ICON_CHOICES.map((c) => (
                  <Box
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Use the ${c.id} icon`}
                    onClick={() => { if (!busy) saveAvatar(drawIcon(c)); }}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!busy) saveAvatar(drawIcon(c)); }
                    }}
                    sx={{
                      width: 46, height: 46, borderRadius: "50%", flexShrink: 0, cursor: busy ? "default" : "pointer",
                      display: "grid", placeItems: "center", fontSize: 23, lineHeight: 1, userSelect: "none",
                      background: `linear-gradient(140deg, ${c.from}, ${c.to})`,
                      transition: "transform .14s ease, box-shadow .14s ease",
                      "&:hover": { transform: busy ? "none" : "scale(1.08)", boxShadow: "0 6px 16px rgba(31,45,78,.2)" },
                      "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
                      "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
                    }}
                  >
                    {c.glyph}
                  </Box>
                ))}
              </Box>
            </Box>
          </Card>

          <Card title="Your details" note="What colleagues see, and where the hub would write to you.">
            <Box sx={{ display: "grid", gap: 2, maxWidth: 460 }}>
              <TextField label="Full name" size="small" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Email" size="small" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Used for sign-in recovery once that is wired up." />
              <Box>
                <Button variant="contained" size="small" disabled={!changed || busy} onClick={saveProfile}
                  sx={{ textTransform: "none", borderRadius: "12px" }}>
                  Save changes
                </Button>
              </Box>
            </Box>

            <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.82rem", color: MUTED, width: 110 }}>Username</Typography>
                <Typography sx={{ fontSize: "0.88rem", color: INK }}>{me.username}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.82rem", color: MUTED, width: 110 }}>Role</Typography>
                <Chip size="small" label={ROLE_LABEL[me.role]} sx={{
                  height: 21, fontSize: "0.7rem", fontWeight: 700,
                  bgcolor: ROLE_TINT[me.role].bg, color: ROLE_TINT[me.role].fg,
                }} />
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: FAINT, lineHeight: 1.5 }}>
                {ROLE_NOTE[me.role]} Your username and role are an admin&rsquo;s to change, not yours — a page
                that let you edit your own role would be the access model undone.
              </Typography>
            </Box>
          </Card>

          <Box sx={{
            ...glass, borderRadius: "18px", p: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
          }}>
            <ShieldOutlinedIcon sx={{ fontSize: 20, color: me.totp_enrolled ? "#1e7e45" : "#b26a00" }} />
            <Typography sx={{ fontSize: "0.88rem", color: INK, flex: 1, minWidth: 0 }}>
              Password and two-factor are next door, under Security.
            </Typography>
            <Button component={Link} href="/settings/security" size="small" variant="outlined"
              sx={{ textTransform: "none", borderRadius: "12px" }}>
              Open Security
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
