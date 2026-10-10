"use client";

/**
 * BORROWING SOMEBODY'S GOOGLE ACCOUNT.
 *
 * The way in when the service account cannot reach a property — at APSOparts,
 * the Search Console domain property, owned by whoever verified the DNS.
 *
 * This panel is deliberately not celebratory. Connecting works and it unblocks
 * the SEO pages, but it makes everyone's view depend on one person's login, and
 * the page says that while it is connected rather than only while deciding.
 * The proper fix stays on screen the whole time.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";
const WARN = "#a96a12";
const OK = "#1b7a55";

type Connection = { email: string; connectedBy: string; connectedAt: string; scopes: string[] };

export default function GoogleAccount() {
  const params = useSearchParams();
  const [conn, setConn] = useState<Connection | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/integrations/google/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setConfigured(!!j.configured);
        setConn(j.connection ?? null);
      })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  // What came back from Google, reported where the person pressed the button.
  useEffect(() => {
    const result = params.get("google");
    if (!result) return;
    const detail = params.get("detail") ?? "";
    if (result === "connected") setNote(`Connected as ${detail}.`);
    else if (result === "cancelled") setNote("You cancelled the Google sign-in. Nothing changed.");
    else setNote(detail || "That did not work.");
  }, [params]);

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      setNote("Disconnected. Search Console goes back to the service account, which still has no access to the property.");
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.55)", mb: 3 }}>
      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, mb: 0.5 }}>
        Connect a Google account instead
      </Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6, mb: 1.5 }}>
        A stopgap for Search Console. The domain property <strong>apsoparts.com</strong> is owned by whoever
        verified the DNS, and until they add the service account the hub gets a 403. Connecting a person&rsquo;s
        own Google account lets the hub read with their permissions in the meantime.
      </Typography>

      {note && (
        <Typography sx={{ fontSize: "0.82rem", color: INK, mb: 1.5, p: 1.25, borderRadius: "10px", bgcolor: "#eef1f5" }}>
          {note}
        </Typography>
      )}

      {conn ? (
        <>
          <Typography sx={{ fontSize: "0.84rem", color: OK, fontWeight: 600 }}>
            {/* Connections made before the hub asked for the email scope have no
                name to show. Say who set it up instead of printing "unknown". */}
            {conn.email && conn.email !== "unknown"
              ? `Reading Google as ${conn.email}`
              : `Reading Google as the account ${conn.connectedBy} signed in with`}
          </Typography>
          <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: 0.25, mb: 1.5 }}>
            Connected by {conn.connectedBy} on{" "}
            {new Date(conn.connectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: WARN, lineHeight: 1.6, mb: 1.5 }}>
            Everyone&rsquo;s SEO pages are read with this one account&rsquo;s permissions. If that person changes their
            Google password, loses access, or leaves, the pages stop for everybody until somebody reconnects —
            and while the OAuth app is unverified, Google expires the connection after seven days regardless.
            The fix that ends all of this is one line: an owner adds the service account to the property.
          </Typography>
          <Button size="small" variant="outlined" disabled={busy} onClick={disconnect}
            sx={{ textTransform: "none", borderRadius: "10px" }}>
            Disconnect
          </Button>
        </>
      ) : configured === false ? (
        <Typography sx={{ fontSize: "0.82rem", color: WARN, lineHeight: 1.6 }}>
          No OAuth client is configured, so there is nothing to connect to yet. It needs
          GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET from the Google Cloud project, with
          this hub&rsquo;s <code>/api/integrations/google/callback</code> registered as an authorised redirect URI.
        </Typography>
      ) : (
        <Button
          size="small" variant="contained" startIcon={<GoogleIcon />}
          href="/api/integrations/google/connect"
          sx={{ textTransform: "none", borderRadius: "10px" }}
        >
          Connect my Google account
        </Button>
      )}
    </Box>
  );
}
