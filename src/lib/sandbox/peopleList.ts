// SANDBOX_PEOPLE, read - pure, so the tests read it without the accounts code (people.ts).

export type Person = { email: string; role: "admin" | "user"; name: string };
export type PendingInvite = { userId: number; email: string; name: string; url: string };

/** "email|role|name" separated by ";" - a bad entry is skipped and named in the log. */
export function parsePeople(raw: string | undefined): { people: Person[]; bad: string[] } {
  const people: Person[] = [];
  const bad: string[] = [];
  for (const part of (raw ?? "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const [email, role, name] = part.split("|").map((s) => s.trim());
    if (!email || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) || (role !== "admin" && role !== "user")) { bad.push(part.split("|")[0]); continue; }
    people.push({ email: email.toLowerCase(), role, name: name || email.split("@")[0] });
  }
  return { people, bad };
}

/** The address a person's link opens on: SANDBOX_PUBLIC_URL, or the domain Railway gives the service. */
export function publicUrl(env: NodeJS.ProcessEnv): string | null {
  if (env.SANDBOX_PUBLIC_URL) return env.SANDBOX_PUBLIC_URL.replace(/\/+$/, "");
  return env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : null;
}
