// Datatracker became an app of its own and answers at /datatracker.
//
// This stays because bookmarks are not ours to break: everyone who has used
// this screen has it saved, and a 404 would read as the app being gone.
import { redirect } from "next/navigation";

export default function MovedToItsOwnApp() {
  redirect("/datatracker");
}
