"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import LockResetIcon from "@mui/icons-material/LockReset";
import KeyIcon from "@mui/icons-material/Key";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Row {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: "admin" | "user" | "viewer";
  is_active: boolean;
  totp_enrolled: boolean;
}

const roleColor: Record<Row["role"], string> = {
  admin: "#ed1b2f", user: "#274e64", viewer: "#5f6368",
};

export function UsersTable({ users }: { users: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || `Failed (${res.status})`);
    } else {
      router.refresh();
    }
  }

  async function resetPassword(u: Row) {
    const pw = prompt("Enter new temporary password (≥10 chars, upper+lower+digit):");
    if (!pw) return;
    await patch(u.id, { resetPassword: pw });
  }

  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Full name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>2FA</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 200 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{u.username}</TableCell>
                <TableCell>{u.full_name}</TableCell>
                <TableCell>
                  <Chip label={u.role} size="small"
                    sx={{ bgcolor: roleColor[u.role], color: "#fff", fontWeight: 700, fontSize: "0.7rem" }} />
                </TableCell>
                <TableCell>{u.is_active ? "Active" : "Disabled"}</TableCell>
                <TableCell>{u.totp_enrolled ? "✓ enrolled" : "— pending"}</TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditing(u)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset password">
                    <IconButton size="small" onClick={() => resetPassword(u)}>
                      <LockResetIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {u.totp_enrolled && (
                    <Tooltip title="Reset 2FA">
                      <IconButton size="small" onClick={() => {
                        if (confirm("Reset 2FA? User will need to scan a new QR on next login.")) {
                          patch(u.id, { resetTotp: true });
                        }
                      }}>
                        <KeyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={u.is_active ? "Disable" : "Enable"}>
                    <IconButton size="small" onClick={() => patch(u.id, { isActive: !u.is_active })}>
                      {u.is_active
                        ? <BlockIcon fontSize="small" sx={{ color: "#ed1b2f" }} />
                        : <CheckCircleIcon fontSize="small" sx={{ color: "#34a853" }} />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {editing && (
        <EditDialog row={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }} />
      )}
    </>
  );
}

function EditDialog({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(row.full_name);
  const [email, setEmail] = useState(row.email ?? "");
  const [role, setRole] = useState<Row["role"]>(row.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email: email || null, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit user</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.5, pt: 1 }}>
        <TextField label="Username" size="small" value={row.username} disabled helperText="Username cannot be changed" />
        <TextField label="Full name" size="small" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="Email" size="small" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField select label="Role" size="small" value={role} onChange={(e) => setRole(e.target.value as Row["role"])}>
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="user">User</MenuItem>
          <MenuItem value="viewer">Viewer</MenuItem>
        </TextField>
        {error && <Box sx={{ color: "#ed1b2f", fontSize: "0.8rem" }}>{error}</Box>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} variant="contained" sx={{ bgcolor: "#ed1b2f", "&:hover": { bgcolor: "#d80901" } }}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
