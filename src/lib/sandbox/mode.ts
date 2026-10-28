// THE SANDBOX SWITCH - the copy of the hub on Railway (APSOAssistant, environment "sandbox") where Diana and Daniel
// build with coded data only (SARCLA 26.10.2026: "absolutely no real data should appear or be stored").
// APSOHUB_SANDBOX=1 is set on that copy and nowhere else. Client-safe: no server imports here.

export function isSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APSOHUB_SANDBOX === "1";
}

/** The sandbox on the person's own computer (`npm run sbx -- dev` sets SANDBOX_LOCAL=1): its pages, for that computer
 *  only. A sandbox without it is the relay on Railway, which serves no page at all. */
export function isLocalSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSandbox(env) && env.SANDBOX_LOCAL === "1";
}
