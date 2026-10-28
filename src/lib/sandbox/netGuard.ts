// THE SANDBOX'S ONLY WAYS OUT - every TCP connection the sandbox opens goes through here, and only these are let
// through: its own database, HubSpot (once the person has set their private app's token - writes are held back by
// hubspot.ts), the read-only door to the microservices (SANDBOX_VIEWER_URL), and Anthropic while SANDBOX_AI=on.
// Magento, the SFTP server, SMTP, the connector, the gateways themselves: refused before a DNS lookup, so a job or a
// button switched on in the sandbox changes nothing real (SARCLA 26.10.2026: "they should be off and if turned on they
// should have no effect at all").
//
// It sits on net.Socket.prototype.connect because everything ends there: fetch (Node's own undici), http/https, pg,
// nodemailer, ssh2. A refused connection fails like a refused port - the socket is destroyed with an error, so each
// caller takes its usual error path instead of throwing somewhere it never expected to.
//
// The second half of the promise is that the sandbox holds no key that can change anything: `npm run sandbox` hands
// the app none of the terminal's, and the person's .env.local holds only a read-only HubSpot app and a viewer key.

import net from "node:net";

export const SANDBOX_BLOCKED = "ESANDBOX";

const INSTALLED = Symbol.for("apsohub.sandbox.netGuard");

function clean(host: string): string {
  return host.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

/** Where the sandbox may connect: itself, its own database, HubSpot with a token set, the door, Anthropic while SANDBOX_AI=on. */
export function allowedHosts(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const hosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if ((env.HUBSPOT_TOKEN ?? "").trim()) hosts.add("api.hubapi.com");
  if (env.SANDBOX_VIEWER_URL) {
    try { hosts.add(clean(new URL(env.SANDBOX_VIEWER_URL).hostname)); } catch { /* an unreadable URL lets nothing extra through */ }
  }
  const url = env.DATABASE_URL;
  if (url) {
    try { hosts.add(clean(new URL(url).hostname)); } catch { /* an unreadable URL lets nothing extra through */ }
  } else if (env.PGHOST) {
    hosts.add(clean(env.PGHOST));
  }
  if (env.SANDBOX_AI === "on") hosts.add("api.anthropic.com");
  return hosts;
}

/** The host a Socket.connect call aims at; null for a local pipe / unix socket (always local, always let through). */
export function targetHost(args: unknown[]): string | null {
  let first: unknown = args[0];
  // net.connect() / tls.connect() hand the socket their normalized [options, callback]
  if (Array.isArray(first)) first = first[0];
  if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    return clean(typeof args[1] === "string" ? args[1] : "localhost");
  }
  if (typeof first === "string") return null;
  if (first && typeof first === "object") {
    const o = first as { host?: unknown; path?: unknown };
    if (typeof o.path === "string" && o.path) return null;
    return clean(typeof o.host === "string" && o.host ? o.host : "localhost");
  }
  return "localhost";
}

/** Install once, before anything else of the sandbox connects (instrumentation.ts, via src/lib/sandbox/boot.ts). */
export function installSandboxGuard(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const allowed = allowedHosts(env);
  const proto = net.Socket.prototype as net.Socket & { [INSTALLED]?: boolean };
  if (proto[INSTALLED]) return allowed;
  const connect = proto.connect;
  proto.connect = function guardedConnect(this: net.Socket, ...args: unknown[]) {
    const host = targetHost(args);
    if (host !== null && !allowed.has(host)) {
      const err = Object.assign(new Error(`sandbox: no connection to ${host} - the sandbox reaches only its database, HubSpot and the door`), {
        code: SANDBOX_BLOCKED,
      });
      console.warn(`[sandbox] blocked a connection to ${host}`);
      process.nextTick(() => this.destroy(err));
      return this;
    }
    return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof proto.connect;
  proto[INSTALLED] = true;
  return allowed;
}
