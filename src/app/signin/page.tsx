"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await r.json().catch(() => ({} as Record<string, unknown>));
      if (!r.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "Sign in failed"
        );
      }
      router.push("/");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Sign in failed. Please try again."
      );
    }
  }

  const tokenError =
    errorParam === "missing_token" || errorParam === "invalid_token"
      ? "Session expired. Please sign in again."
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
            <Alert
              severity="warning"
              sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}
            >
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
              disabled={status === "loading"}
              sx={{ mb: 2 }}
            />
            <TextField
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              disabled={status === "loading"}
              sx={{ mb: 2.5 }}
            />
            <Button
              type="submit"
              disabled={status === "loading" || !email.trim() || !password}
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
              {status === "loading" ? (
                <CircularProgress size={18} sx={{ color: "#fff" }} />
              ) : (
                "Sign in"
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
