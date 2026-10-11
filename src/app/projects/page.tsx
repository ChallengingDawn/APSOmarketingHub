import Box from "@mui/material/Box";
import { requireUser } from "@/lib/auth/guard";
import ContentHome from "./ContentHome";

export const dynamic = "force-dynamic";

/**
 * The door to Marketing & Content.
 *
 * A server component purely so the greeting can use the person's real name
 * without a round trip — the hub knows who they are before the page renders,
 * and "Good evening, Claudio" fetched afterwards arrives as a flicker.
 */
export default async function ProjectsPage() {
  const me = await requireUser();
  const first = (me.full_name || me.username).split(" ")[0];

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <ContentHome name={first} />
    </Box>
  );
}
