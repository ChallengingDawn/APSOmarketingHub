import { redirect } from "next/navigation";

/**
 * The old proposal board ran on a fixed set of bundled example posts. Create
 * Studio replaced it with real generation saved to the content database, so
 * this route now forwards there and old links keep working.
 */
export default function ContentStudioPage() {
  redirect("/create");
}
