import { redirect } from "next/navigation";
import { LIBRARY_KINDS, libraryHref } from "@/lib/content/library";

/** The content library's door: its first kind (Pages). */
export default function LibraryPage() {
  redirect(libraryHref(LIBRARY_KINDS[0].slug));
}
