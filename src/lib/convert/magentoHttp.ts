// ONE REQUEST TO MAGENTO, READ LENIENTLY (09.11.2026). ACC answers some REST requests with a chunk size padded by a space
// ("C6C \r\n" - read with curl --raw, GET only, 09.11.2026): Node's fetch (undici, a strict parser) fails them with
// HPE_INVALID_CHUNK_SIZE, and the same request through node:https with insecureHTTPParser reads fine. The padding comes
// and goes with the answer's size, so a write could read its page and then fail on the next answer. This is fetch's
// shape (./cmsPage.ts FetchLike) over node:https, only for Magento's REST API - nothing else in the hub uses it.

import https from "node:https";
import zlib from "node:zlib";
import type { FetchLike } from "./cmsPage";

const MAX = 8_000_000;

export const magentoFetch: FetchLike = (url, init) => new Promise((resolve, reject) => {
  const u = new URL(url);
  if (u.protocol !== "https:") { reject(new Error("Magento is only reached over https.")); return; }
  const body = init.body === undefined ? undefined : Buffer.from(init.body, "utf8");
  const req = https.request(u, {
    method: init.method,
    insecureHTTPParser: true,
    headers: { ...init.headers, "Accept-Encoding": "gzip", ...(body ? { "Content-Length": String(body.length) } : {}) },
    timeout: 30_000,
  }, (res) => {
    const parts: Buffer[] = [];
    let size = 0;
    res.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX) { req.destroy(new Error("Magento's answer is too big.")); return; }
      parts.push(c);
    });
    res.on("end", () => {
      let buf = Buffer.concat(parts);
      try { if (/gzip/i.test(String(res.headers["content-encoding"] ?? ""))) buf = zlib.gunzipSync(buf); } catch { /* kept as it came */ }
      const text = buf.toString("utf8");
      resolve({ status: res.statusCode ?? 0, text: async () => text });
    });
    res.on("error", reject);
  });
  req.on("timeout", () => req.destroy(new Error("Magento did not answer within 30 seconds.")));
  req.on("error", reject);
  if (body) req.write(body);
  req.end();
});
