// People & access — the one screen where access is given, and therefore the one
// place to look when somebody asks why they cannot see something.
//
// Admin only, enforced on the server: the guard runs here, and the API behind
// the table checks again rather than trusting that this page did.
import { requireAdmin } from "@/lib/auth/guard";
import PeopleAccess from "./PeopleAccess";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  await requireAdmin();
  return <PeopleAccess />;
}
