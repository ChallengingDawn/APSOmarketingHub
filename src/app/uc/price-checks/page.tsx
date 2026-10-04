// Price checks is a UC app: it applies the rule and creates the HubSpot ticket,
// which is a different job from recording what the shop saw.
//
// The screen itself still lives inside the Datatracker as a tab. This route
// exists so the app has its OWN address from the start — when the screen is
// split out properly, the URL people have bookmarked does not change.
import { redirect } from "next/navigation";

export default function PriceChecksApp() {
  redirect("/datatracker#price-checks");
}
