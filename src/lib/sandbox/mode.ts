// THE SANDBOX SWITCH - the copy of the hub on Railway (APSOAssistant, environment "sandbox") where Diana and Daniel
// build with coded data only (SARCLA 26.10.2026: "absolutely no real data should appear or be stored").
// APSOHUB_SANDBOX=1 is set on that copy and nowhere else. Client-safe: no server imports here.

export function isSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APSOHUB_SANDBOX === "1";
}
