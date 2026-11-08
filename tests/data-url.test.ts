import assert from "node:assert/strict";
import { test } from "node:test";
import { dataUrlToBlob } from "../src/lib/dataUrl";

// fetch("data:…") is refused by the hub's CSP - the export decodes in place instead (08.11.2026).

test("a base64 picture comes back byte for byte with its type", async () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255, 128]);
  const url = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  const b = dataUrlToBlob(url);
  assert.ok(b);
  assert.equal(b.type, "image/png");
  assert.deepEqual(new Uint8Array(await b.arrayBuffer()), png);
});

test("plain text data and parameters, and anything else is not a data address", async () => {
  const b = dataUrlToBlob("data:text/plain;charset=utf-8,Gr%C3%BCezi");
  assert.equal(await b!.text(), "Grüezi");
  assert.equal(dataUrlToBlob("https://example.com/a.png"), null);
  assert.equal(dataUrlToBlob("blob:http://localhost/1"), null);
});
