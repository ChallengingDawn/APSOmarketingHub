import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { requireAdmin } from "@/lib/auth/guard";
import { CreateUserForm } from "./create-user-form";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

interface UserSummary {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  totp_enrolled: boolean;
}

export default async function AdminPage() {
  await requireAdmin();
  await ensureSchema();
  const r = await query<UserSummary>(
    `SELECT id, username, full_name, email, role, is_active, totp_enrolled
       FROM apsomh_users
      ORDER BY created_at DESC`,
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.6rem", fontWeight: 600, color: "#1f1f1f" }}>
          Admin · Users
        </Typography>
        <Typography sx={{ fontSize: "0.85rem", color: "#5f6368" }}>
          Create, edit and manage user accounts
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2.5 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, mb: 2 }}>
              Create user
            </Typography>
            <CreateUserForm />
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, mb: 0.5 }}>
              All users ({r.rows.length})
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mb: 2 }}>
              <strong style={{ color: "#ed1b2f" }}>Admin</strong> manages users · <strong style={{ color: "#274e64" }}>User</strong> standard access · <strong>Viewer</strong> read-only
            </Typography>
            <UsersTable users={r.rows} />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
