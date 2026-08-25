import { permanentRedirect } from "next/navigation";

/**
 * The content calendar moved onto Overview ("/"), where it renders from the
 * real content store. This route is kept only so old links and bookmarks
 * resolve — it holds no UI of its own.
 */
export default function CalendarRedirectPage(): never {
  permanentRedirect("/");
}
