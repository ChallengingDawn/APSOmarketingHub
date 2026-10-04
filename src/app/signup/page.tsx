// There is one door now.
//
// Signing in and setting up an account are the same page: it asks for your
// address and works out which of the two you need. This route stays so the
// links and bookmarks that went to it still land somewhere sensible.

import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/signin");
}
