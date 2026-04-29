"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";

export function CreateUserForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<"admin" | "user" | "viewer">("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, fullName, email: email || undefined,
          initialPassword: pw, role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setUsername(""); setFullName(""); setEmail(""); setPw(""); setRole("user");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Box component="form" onSubmit={submit}
      sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
      <TextField label="Email or username" size="small" value={username}
        onChange={(e) => setUsername(e.target.value)} required
        placeholder="claudio.saraiva@apsoparts.com" />
      <TextField label="Full name" size="small" value={fullName}
        onChange={(e) => setFullName(e.target.value)} required />
      <TextField label="Email (optional)" type="email" size="small" value={email}
        onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Initial password" size="small" value={pw}
        onChange={(e) => setPw(e.target.value)} required
        helperText="≥10 chars, upper + lower + digit. Forced change on first login." />
      <TextField select label="Role" size="small" value={role}
        onChange={(e) => setRole(e.target.value as "admin" | "user" | "viewer")}>
        <MenuItem value="user">User — standard access</MenuItem>
        <MenuItem value="admin">Admin — full access</MenuItem>
        <MenuItem value="viewer">Viewer — read-only</MenuItem>
      </TextField>
      <Box />
      {error && <Alert severity="error" sx={{ gridColumn: "1 / -1", fontSize: "0.8rem" }}>{error}</Alert>}
      <Box sx={{ gridColumn: "1 / -1" }}>
        <Button type="submit" disabled={busy}
          sx={{ bgcolor: "#ed1b2f", color: "#fff", borderRadius: 999, textTransform: "none", fontWeight: 600, py: 1, px: 3,
            "&:hover": { bgcolor: "#d80901" }, "&.Mui-disabled": { bgcolor: "#fbb1b8", color: "#fff" } }}>
          {busy ? "Creating…" : "Create user"}
        </Button>
      </Box>
    </Box>
  );
}
