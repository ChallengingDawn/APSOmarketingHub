// DoC moved to Website, under Microservices (SARCLA, 13.10.2026).
//
// This stays because bookmarks are not ours to break: the address was shared when
// DoC went live, and a 404 would read as the app being gone.
import { redirect } from "next/navigation";

export default function MovedToWebsite() {
  redirect("/website/doc");
}
