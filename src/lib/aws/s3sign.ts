// AWS SIGNATURE VERSION 4 FOR S3 (11.11.2026). Pure - node:crypto only, no SDK (the hub adds no dependency for two calls:
// a HEAD and a PUT of a picture, ../content/studio/kinds/page/pictureStore.ts). Tested against AWS's own examples in
// "Authenticating Requests: Using the Authorization Header (AWS Signature Version 4)" (Amazon S3 API reference):
// tests/studio-page-media-store.test.ts.
//
// The way (S3's flavour of SigV4): the canonical request - method, the path URI-encoded once per segment ("/" kept), the
// query sorted, each signed header "name:value" lower-cased and trimmed, the signed header names, the payload's SHA-256 (or
// UNSIGNED-PAYLOAD) - hashed into the string to sign with the date and the scope (day/region/s3/aws4_request); the key is
// HMAC'd down from "AWS4"+secret through day, region, service and "aws4_request".

import { createHash, createHmac } from "node:crypto";

export type AwsCredentials = { accessKeyId: string; secretAccessKey: string; sessionToken?: string | null };

export type SignInput = {
  method: string;
  /** the host the request goes to (virtual-hosted: <bucket>.s3.<region>.amazonaws.com) */
  host: string;
  /** the object's path, NOT encoded yet: "/content/a b.jpg" */
  path: string;
  query?: Readonly<Record<string, string>>;
  /** further headers to send and sign (content-type, x-amz-storage-class ...) - host, x-amz-date, x-amz-content-sha256
   * and x-amz-security-token are added here */
  headers?: Readonly<Record<string, string>>;
  /** the payload's SHA-256 in hex, or "UNSIGNED-PAYLOAD" */
  payloadHash: string;
  region: string;
  service?: string;
  /** when it is signed (AWS takes 15 minutes either way) */
  now: Date;
};

export type Signed = {
  /** every header to send, Authorization included (host too - fetch sets the same one itself) */
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
};

export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986 encoding as SigV4 wants it: everything but A-Z a-z 0-9 - . _ ~ as %XX (upper case). */
export function uriEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** S3's canonical path: each segment encoded once, its slashes kept. */
export const canonicalPath = (path: string) => (path.startsWith("/") ? path : `/${path}`).split("/").map(uriEncode).join("/");

/** 20130524T000000Z and 20130524. */
export function amzDate(now: Date): { stamp: string; day: string } {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { stamp, day: stamp.slice(0, 8) };
}

/** The signing key: HMAC("AWS4"+secret, day) -> region -> service -> "aws4_request". */
export function signingKey(secret: string, day: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), "aws4_request");
}

/** A request signed: the headers to send, with the steps that made them (for the tests and for a 403's reading). */
export function signS3(input: SignInput, creds: AwsCredentials): Signed {
  const service = input.service ?? "s3";
  const { stamp, day } = amzDate(input.now);
  const all: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers ?? {})) all[k.toLowerCase()] = String(v);
  all.host = input.host;
  all["x-amz-date"] = stamp;
  all["x-amz-content-sha256"] = input.payloadHash;
  if (creds.sessionToken) all["x-amz-security-token"] = creds.sessionToken;
  const names = Object.keys(all).sort();
  const canonicalHeaders = names.map((n) => `${n}:${all[n].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const query = Object.entries(input.query ?? {})
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join("&");
  const canonicalRequest = [input.method.toUpperCase(), canonicalPath(input.path), query, canonicalHeaders, signedHeaders, input.payloadHash].join("\n");
  const scope = `${day}/${input.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(creds.secretAccessKey, day, input.region, service)).update(stringToSign, "utf8").digest("hex");
  const headers: Record<string, string> = { ...all, authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}` };
  return { headers, canonicalRequest, stringToSign, signature };
}
