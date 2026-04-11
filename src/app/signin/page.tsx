"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

function SignInForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Couldn't send the link. Please try again.");
    }
  }

  const tokenError =
    errorParam === "missing_token"
      ? "The sign-in link is missing. Please request a new one."
      : errorParam === "invalid_token"
      ? "That sign-in link is invalid or has expired. Please request a new one."
      : null;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f6f7f9",
        p: 3,
      }}
    >
      <Card
        sx={{
          maxWidth: 460,
          width: "100%",
          borderRadius: 4,
          border: "1px solid #ececec",
          borderTop: "3px solid #ed1b2f",
          boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "#ed1b2f",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.02em",
              }}
            >
              APSO
            </Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  fontSize: "1.3rem",
                  fontWeight: 600,
                  color: "#1f1f1f",
                  letterSpacing: "-0.015em",
                  lineHeight: 1.2,
                }}
              >
                Marketing Hub
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
                APSOparts · Sealings &amp; Plastics
              </Typography>
            </Box>
          </Box>

          {status === "sent" ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  bgcolor: "#e6f4ea",
                  color: "#1e8e3e",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 2,
                }}
              >
                <MailOutlineIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "#1f1f1f",
                  mb: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                Check your inbox
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  color: "#5f6368",
                  lineHeight: 1.5,
                  mb: 2,
                }}
              >
                If your email is on the allow-list, a sign-in link is on its way. It expires in 15 minutes.
              </Typography>
              <Button
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                }}
                sx={{
                  fontSize: "0.78rem",
                  color: "#5f6368",
                  textTransform: "none",
                  "&:hover": { bgcolor: "#f1f3f4" },
                }}
              >
                Use a different email
              </Button>
            </Box>
          ) : (
            <>
              <Typography
                sx={{
                  fontSize: "0.9rem",
                  color: "#3c4043",
                  mb: 2.5,
                  lineHeight: 1.5,
                }}
              >
                Sign in with your corporate email. We&apos;ll send you a one-time link — no password needed.
              </Typography>

              {tokenError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>
                  {tokenError}
                </Alert>
              )}

              <form onSubmit={onSubmit}>
                <TextField
                  type="email"
                  label="Corporate email"
                  placeholder="yourname@angst-pfister.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  disabled={status === "sending"}
                  sx={{ mb: 2 }}
                />
                <Button
                  type="submit"
                  disabled={status === "sending" || !email.trim()}
                  fullWidth
                  sx={{
                    bgcolor: "#ed1b2f",
                    color: "#fff",
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    py: 1.25,
                    boxShadow: "none",
                    "&:hover": { bgcolor: "#d80901", boxShadow: "none" },
                    "&.Mui-disabled": {
                      bgcolor: "#fbb1b8",
                      color: "#fff",
                    },
                  }}
                >
                  {status === "sending" ? (
                    <CircularProgress size={18} sx={{ color: "#fff" }} />
                  ) : (
                    "Send sign-in link"
                  )}
                </Button>
                {status === "error" && (
                  <Alert
                    severity="error"
                    sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}
                  >
                    {errorMsg}
                  </Alert>
                )}
              </form>
            </>
          )}

          <Box
            sx={{
              mt: 3,
              pt: 2.5,
              borderTop: "1px solid #f1f3f4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 14, color: "#1e8e3e" }} />
            <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>
              Restricted to @angst-pfister.com and @apsoparts.com
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#f6f7f9",
          }}
        >
          <CircularProgress sx={{ color: "#ed1b2f" }} />
        </Box>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
