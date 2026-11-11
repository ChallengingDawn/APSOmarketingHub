// S3 FROM THE HUB'S TASK (11.11.2026): a HEAD and a PUT of an object, signed with ./s3sign.ts, with the ECS task role's
// credentials - read from the container credentials endpoint (http://169.254.170.2 + AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)
// and kept until five minutes before they expire. No SDK. Relative imports only.

import { EMPTY_SHA256, canonicalPath, sha256Hex, signS3, type AwsCredentials } from "./s3sign";

const CREDENTIALS_HOST = "http://169.254.170.2";
const EARLY = 5 * 60_000;

type Held = AwsCredentials & { until: number };
let held: Held | null = null;
let reading: Promise<Held> | null = null;

/** Can this process sign at all (the ECS task's credentials are offered)? A laptop cannot. */
export const hasTaskCredentials = () => !!(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ?? "").trim();

/** The task role's credentials, read once and kept until five minutes before their Expiration. */
export async function taskCredentials(): Promise<AwsCredentials> {
  if (held && Date.now() < held.until) return held;
  const rel = (process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ?? "").trim();
  if (!rel) throw new Error("No task credentials here (AWS_CONTAINER_CREDENTIALS_RELATIVE_URI is not set).");
  reading ??= (async () => {
    const r = await fetch(`${CREDENTIALS_HOST}${rel.startsWith("/") ? rel : `/${rel}`}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`The task's credentials could not be read (${r.status}).`);
    const j = (await r.json()) as { AccessKeyId?: string; SecretAccessKey?: string; Token?: string; Expiration?: string };
    if (!j.AccessKeyId || !j.SecretAccessKey) throw new Error("The task's credentials came without a key.");
    const exp = j.Expiration ? Date.parse(j.Expiration) : NaN;
    // without an Expiration: kept ten minutes
    const until = Number.isFinite(exp) ? exp - EARLY : Date.now() + 10 * 60_000;
    held = { accessKeyId: j.AccessKeyId, secretAccessKey: j.SecretAccessKey, sessionToken: j.Token ?? null, until };
    return held;
  })().finally(() => { reading = null; });
  return reading;
}

export type S3Target = { bucket: string; region: string; key: string };
const hostOf = (t: S3Target) => `${t.bucket}.s3.${t.region}.amazonaws.com`;

async function send(t: S3Target, method: "HEAD" | "PUT", body: Buffer | null, headers: Record<string, string> = {}): Promise<Response> {
  const creds = await taskCredentials();
  const host = hostOf(t);
  const path = `/${t.key}`;
  const signed = signS3({ method, host, path, headers, payloadHash: body ? sha256Hex(body) : EMPTY_SHA256, region: t.region, now: new Date() }, creds);
  const { host: _h, ...sent } = signed.headers;
  const url = `https://${host}${canonicalPath(path)}`;
  return fetch(url, { method, headers: sent, body: body ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(method === "PUT" ? 30_000 : 8000) });
}

/** Is the object there? true / false (404) - anything else is an error (403: the role may not read it). */
export async function s3Has(t: S3Target): Promise<boolean> {
  const r = await send(t, "HEAD", null);
  if (r.status === 200) return true;
  if (r.status === 404) return false;
  throw new Error(`S3 answered ${r.status}${r.status === 403 ? " (not allowed)" : ""}.`);
}

/** The object written, with its type and caching. */
export async function s3Put(t: S3Target, body: Buffer, contentType: string, cacheControl: string): Promise<void> {
  const r = await send(t, "PUT", body, { "content-type": contentType, "cache-control": cacheControl });
  if (r.status !== 200) {
    const text = (await r.text().catch(() => "")).slice(0, 400);
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
    throw new Error(`S3 answered ${r.status}${code ? ` (${code})` : ""}.`);
  }
}
