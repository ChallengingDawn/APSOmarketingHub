// THE INVITATION MAIL'S WORDS (./inviteMail.ts sends it) - pure, so a test reads exactly what a new person is told.
// SARCLA 10.11.2026, on Add a person: "are we sending a mail here? ... it would be easier to send the mail and user".

import { mfaRequired, type Cross, type Role } from "./access";

export type InviteMailFor = { fullName: string; email: string; signInWith: string; role: Role; cross: Cross | null };
export type InviteMailFrom = { fullName: string; email: string | null };

/** What they will find, said to them (access.ts ROLE_NOTE / CROSS_NOTE speak to the admin). */
export function whatTheySee(role: Role, cross: Cross | null): string {
  if (cross === "user") return "The Angst+Pfister hub, and the APSOparts hub to look at.";
  if (cross === "admin") return "The Angst+Pfister hub and the APSOparts hub, as an admin of both.";
  if (role === "admin") return "The whole APSOparts hub, as an admin.";
  if (role === "sales_leader") return "Every app of the APSOparts hub to look at, and Advanced reporting.";
  return "The Datatracker to start with; more as it is opened to you.";
}

/** Subject, heading, the opening line, the rows and the last line - the hub's address and the one to sign in with, never
 *  a password and never a link that signs in: the door asks a never-used account to choose its password. */
export function inviteContent(to: InviteMailFor, from: InviteMailFrom) {
  const ap = to.cross !== null;
  const first = to.fullName.trim().split(/\s+/)[0] || to.fullName;
  const rows: [string, string][] = [
    ["Sign in with", to.signInWith],
    ["You will see", whatTheySee(to.role, to.cross)],
    ...(mfaRequired(to.role, ap, false)
      ? [["Second factor", "An authenticator app on your phone (Microsoft or Google Authenticator) - the hub shows a QR code at the first sign-in."] as [string, string]]
      : []),
    ["It opens", "From the Angst+Pfister network."],
  ];
  return {
    subject: ap ? "Your access to the Angst+Pfister hub" : "Your access to the APSOhub",
    heading: ap ? "Welcome to the Angst+Pfister hub" : "Welcome to the APSOhub",
    intro: `Hello ${first}, ${from.fullName} has opened ${ap ? "the Angst+Pfister hub" : "the APSOhub"} to you. The first time you sign in, you choose your own password - nobody else ever knows it.`,
    rows,
    footer: from.email ? `${from.fullName} added you to the hub. Reply to this mail to reach them.` : `${from.fullName} added you to the hub.`,
  };
}
