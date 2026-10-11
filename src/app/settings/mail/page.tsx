"use client";
// SETTINGS > MAIL (SARCLA, 11.10.2026: "a mail settings where you can see the
// mail template ... it's coming from the HUB"). How the hub sends mail - its
// relay, the address it sends as, where replies go - and every mail it sends,
// shown the way an inbox would show it: from, reply-to, subject, the message.
// The previews are rendered by the same functions that render the real mail.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ForwardToInboxIcon from "@mui/icons-material/ForwardToInbox";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";
const GREEN = "#1b7a55";
const RED = "#c5221f";
const glass = {
  bgcolor: "rgba(255,255,255,.72)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)", borderRadius: "20px",
};

type Template = { key: string; name: string; audience: string; when: string; from: string; replyTo: string; subject: string; html: string; text: string };
type Data = { relay: { host: string; port: number; ready: boolean }; from: string; replyTo: string; me: string | null; templates: Template[] };

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, py: 0.6, borderTop: `1px solid ${HAIRLINE}`, fontSize: "0.84rem" }}>
      <Box sx={{ width: 92, flexShrink: 0, color: FAINT }}>{k}</Box>
      <Box sx={{ color: INK, minWidth: 0, overflowWrap: "anywhere" }}>{v}</Box>
    </Box>
  );
}

export default function MailSettings() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string>("project-invite");
  const [view, setView] = useState<"html" | "text">("html");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/mail").then((r) => r.json())
      .then((j) => (j.ok ? setData(j) : setError(j.error ?? "Could not read the mail settings.")))
      .catch(() => setError("Could not read the mail settings."));
  }, []);

  const t = data?.templates.find((x) => x.key === pick) ?? data?.templates[0];

  const test = async () => {
    if (!t) return;
    setSending(true); setSent(null);
    try {
      const j = await fetch("/api/settings/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", template: t.key }) }).then((r) => r.json());
      setSent(j.ok ? { ok: true, text: `Sent to ${j.to}.` } : { ok: false, text: j.error ?? "Not sent." });
    } finally { setSending(false); }
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1200 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: "11px", display: "grid", placeItems: "center", bgcolor: "#e6edfd", color: "#2459d1", "& svg": { fontSize: 19 } }}>
          <ForwardToInboxIcon />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>Mail</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>How the hub sends email, and every email it sends.</Typography>
        </Box>
      </Box>

      {error && <Typography sx={{ fontSize: "0.88rem", color: RED }}>{error}</Typography>}
      {!data && !error && <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>Loading…</Typography>}

      {data && (
        <>
          <Box sx={{ ...glass, p: { xs: 2, md: 2.5 } }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 1 }}>How it is sent</Typography>
            <Line k="Relay" v={<>
              {data.relay.host}:{data.relay.port} (HubSpot SMTP){" "}
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, ml: 1, color: data.relay.ready ? GREEN : RED, fontWeight: 600 }}>
                {data.relay.ready ? <CheckCircleIcon sx={{ fontSize: 15 }} /> : <ErrorOutlineIcon sx={{ fontSize: 15 }} />}
                {data.relay.ready ? "ready" : "not set up - no mail leaves the hub"}
              </Box>
            </>} />
            <Line k="Sends as" v={data.from} />
            <Line k="Replies to" v={`${data.replyTo}, unless the mail says otherwise`} />
            <Line k="Your address" v={data.me ?? "none on your account - tests cannot reach you"} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "300px 1fr" }, alignItems: "start" }}>
            <Box sx={{ ...glass, p: 1 }}>
              {data.templates.map((x) => {
                const on = x.key === t?.key;
                return (
                  <Box key={x.key} component="button" onClick={() => { setPick(x.key); setSent(null); }} sx={{
                    display: "block", width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit",
                    p: 1.5, borderRadius: "14px", bgcolor: on ? "#e4ecfd" : "transparent", "&:hover": { bgcolor: on ? "#e4ecfd" : "rgba(21,34,58,.04)" },
                  }}>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: on ? "#2459d1" : INK }}>{x.name}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>To {x.audience.toLowerCase()}</Typography>
                  </Box>
                );
              })}
            </Box>

            {t && (
              <Box sx={{ ...glass, p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 1.25, lineHeight: 1.55 }}>{t.when}</Typography>
                <Line k="From" v={t.from} />
                <Line k="Reply to" v={t.replyTo} />
                <Line k="Subject" v={<b>{t.subject}</b>} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, mb: 1, flexWrap: "wrap" }}>
                  {(["html", "text"] as const).map((v) => (
                    <Box key={v} component="button" onClick={() => setView(v)} sx={{
                      border: `1px solid ${view === v ? "#2459d1" : HAIRLINE}`, bgcolor: view === v ? "#e4ecfd" : "#fff", color: view === v ? "#2459d1" : MUTED,
                      borderRadius: "999px", px: 1.4, py: 0.4, cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600,
                    }}>{v === "html" ? "As it looks" : "Plain text"}</Box>
                  ))}
                  <Box sx={{ flex: 1 }} />
                  {sent && <Typography sx={{ fontSize: "0.8rem", color: sent.ok ? GREEN : RED }}>{sent.text}</Typography>}
                  <Button size="small" variant="outlined" disabled={sending || !data.me || !data.relay.ready} onClick={test}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
                    {sending ? "Sending…" : "Send me a test"}
                  </Button>
                </Box>
                {view === "html" ? (
                  // sandboxed: the mail's own HTML, nothing of the hub's page can reach it
                  <Box component="iframe" title={`${t.name} preview`} sandbox="" srcDoc={t.html}
                    sx={{ width: "100%", height: 620, border: `1px solid ${HAIRLINE}`, borderRadius: "14px", bgcolor: "#fff" }} />
                ) : (
                  <Box component="pre" sx={{ m: 0, p: 2, border: `1px solid ${HAIRLINE}`, borderRadius: "14px", bgcolor: "#fff", fontSize: "0.82rem", color: INK, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                    {t.text}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
