"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  async function sendCode() {
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({} as Record<string, unknown>));
        const detail = typeof body.detail === "string" ? body.detail : "";
        const from = typeof body.from === "string" ? body.from : "";
        const st = typeof body.status === "number" ? body.status : r.status;
        throw new Error(
          `Email provider returned ${st}. ${detail || "No detail"}${from ? ` (from: ${from})` : ""}`
        );
      }
      setStep("code");
      setCode("");
      setStatus("idle");
      setCooldown(60);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Couldn't send the code. Please try again.");
    }
  }

  async function verifyCode() {
    if (code.trim().length !== 6) return;
    setStatus("verifying");
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await r.json().catch(() => ({} as Record<string, unknown>));
      if (!r.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "Invalid code. Please try again."
        );
      }
      router.push("/");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Verification failed.");
    }
  }

  function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendCode();
  }

  function onCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    verifyCode();
  }

  const tokenError =
    errorParam === "missing_token"
      ? "Session expired. Please sign in again."
      : errorParam === "invalid_token"
      ? "Session invalid or expired. Please sign in again."
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
                APSOparts
              </Typography>
            </Box>
          </Box>

          {tokenError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>
              {tokenError}
            </Alert>
          )}

          {step === "email" ? (
            <form onSubmit={onEmailSubmit}>
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
                  "&.Mui-disabled": { bgcolor: "#fbb1b8", color: "#fff" },
                }}
              >
                {status === "sending" ? (
                  <CircularProgress size={18} sx={{ color: "#fff" }} />
                ) : (
                  "Send sign-in code"
                )}
              </Button>
              {status === "error" && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}>
                  {errorMsg}
                </Alert>
              )}
            </form>
          ) : (
            <form onSubmit={onCodeSubmit}>
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    bgcolor: "#e8f0fe",
                    color: "#274e64",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 1.5,
                  }}
                >
                  <LockOutlinedIcon sx={{ fontSize: 28 }} />
                </Box>
                <Typography
                  sx={{
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "#1f1f1f",
                    letterSpacing: "-0.01em",
                    mb: 0.5,
                  }}
                >
                  Enter your code
                </Typography>
                <Typography sx={{ fontSize: "0.82rem", color: "#5f6368", lineHeight: 1.5 }}>
                  We sent a 6-digit code to <strong>{email}</strong>
                </Typography>
              </Box>

              <TextField
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                }}
                placeholder="000000"
                fullWidth
                autoFocus
                disabled={status === "verifying"}
                inputProps={{
                  maxLength: 6,
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  style: {
                    textAlign: "center",
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    letterSpacing: "0.5em",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  },
                }}
                sx={{ mb: 2 }}
              />

              <Button
                type="submit"
                disabled={status === "verifying" || code.length !== 6}
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
                  "&.Mui-disabled": { bgcolor: "#fbb1b8", color: "#fff" },
                }}
              >
                {status === "verifying" ? (
                  <CircularProgress size={18} sx={{ color: "#fff" }} />
                ) : (
                  "Verify"
                )}
              </Button>

              {status === "error" && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}>
                  {errorMsg}
                </Alert>
              )}

              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
                <Button
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setStatus("idle");
                    setErrorMsg("");
                  }}
                  sx={{
                    fontSize: "0.78rem",
                    color: "#5f6368",
                    textTransform: "none",
                    "&:hover": { bgcolor: "#f1f3f4" },
                  }}
                >
                  Change email
                </Button>
                <Button
                  onClick={() => sendCode()}
                  disabled={cooldown > 0 || status === "sending"}
                  sx={{
                    fontSize: "0.78rem",
                    color: cooldown > 0 ? "#9aa0a6" : "#274e64",
                    textTransform: "none",
                    "&:hover": { bgcolor: "#f1f3f4" },
                  }}
                >
                  {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
                </Button>
              </Box>
            </form>
          )}
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
