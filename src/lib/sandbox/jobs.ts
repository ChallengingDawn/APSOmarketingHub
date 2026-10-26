// Which jobs a sandbox copy may start, and the one database it must never run on. Pure - the tests read it without
// pulling in the jobs themselves (those live in boot.ts).

/** The jobs SANDBOX_JOBS names, known ones only, in its order; the unknown ones apart so the boot line can say so. */
export function pickJobs(raw: string | undefined, known: readonly string[]): { on: string[]; unknown: string[] } {
  const names = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const on: string[] = [];
  const unknown: string[] = [];
  for (const n of names) {
    if (!known.includes(n)) unknown.push(n);
    else if (!on.includes(n)) on.push(n);
  }
  return { on, unknown };
}

/** The hub's own database (Aurora) is never a sandbox's: refuse to start rather than run on it. */
export function looksLikeHubDatabase(env: NodeJS.ProcessEnv): boolean {
  const target = `${env.DATABASE_URL ?? ""} ${env.PGHOST ?? ""}`.toLowerCase();
  return target.includes("rds.amazonaws.com");
}
