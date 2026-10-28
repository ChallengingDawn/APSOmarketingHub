// THE SANDBOX SWITCH - the copy of the hub Diana and Daniel run on their own computers (SARCLA 28.10.2026: the code in a
// GitHub of its own, run on localhost; HubSpot through their own private app, the microservices through a read-only door
// on the Smart-Search gateway). APSOHUB_SANDBOX=1 is set by `npm run sandbox` and nowhere else. Client-safe: no server
// imports here.

export function isSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APSOHUB_SANDBOX === "1";
}

/** What a sandbox has instead of a gateway's admin key: its pages see "configured", its calls go through the door
 *  (viewer.ts), and anything that still called a gateway itself would carry this, which no gateway takes. */
export const DOOR_KEY = "sandbox-door";
