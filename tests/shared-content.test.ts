import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { creativeSchema } from "../src/lib/db/creative-schema";
import { canEditContent, contentPatchSchema, contentUpdateStatement } from "../src/lib/content-edit";
import { designDocumentSchema, type DesignDocument } from "../src/lib/design-document";
import { readBoundedJson } from "../src/lib/read-json";
import { canonicalDesign } from "../src/lib/design-document";

const document: DesignDocument = {
  schemaVersion: 1, canvas: { w: 1200, h: 627 },
  background: { color: "#ffffff", gradientId: null, customGradient: { from: "#16303f", to: "#ed1b2f" }, src: "/brand/apsoparts-logo.svg", scrim: 40 },
  nodes: [{ id: "headline", kind: "text", x: 80, y: 40, fill: "#274e64", text: "Präzision für morgen", fontSize: 60, locked: true }],
};

test("legacy upgrade, editable round-trip, stale writers and approval invalidation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE apsomh_content (
      id SERIAL PRIMARY KEY, channel TEXT, title TEXT, body TEXT, image_url TEXT,
      status TEXT, scheduled_for TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW()
    ); INSERT INTO apsomh_content (channel,title,body,image_url,status,scheduled_for)
      VALUES ('linkedin','Original','Approved copy','/mood/oring.png','approved','2026-10-01T10:00:00Z');`);
    for (let run = 0; run < 2; run++) for (const sql of creativeSchema) await db.exec(sql);
    const original = (await db.query<{ body: string; revision: number; scheduled_for: Date; image_url: string }>("SELECT * FROM apsomh_content")).rows[0];
    assert.equal(original.revision, 1);
    assert.equal(original.body, "Approved copy");
    assert.equal(original.image_url, "/mood/oring.png");
    assert.equal(original.scheduled_for.toISOString(), "2026-10-01T10:00:00.000Z");

    const save = async (edit: unknown, actor = "editor-a") => {
      const sql = contentUpdateStatement(1, contentPatchSchema.parse(edit), actor);
      return db.query<{ revision: number; status: string; body: string; design_document: DesignDocument }>(sql.text, sql.values);
    };
    const first = await save({ expectedRevision: 1, designDocument: document, imageUrl: "/mood/no-surcharge.png" });
    assert.equal(first.rows[0].revision, 2);
    assert.equal(first.rows[0].status, "draft");
    assert.deepEqual(first.rows[0].design_document, document);
    assert.equal((await save({ expectedRevision: 1, body: "Stale overwrite" }, "editor-b")).rows.length, 0);
    const history = await db.query<{ snapshot: { body: string; revision: number; status: string } }>("SELECT snapshot FROM apsomh_content_revisions");
    assert.equal(history.rows.length, 1);
    assert.equal(history.rows[0].snapshot.body, "Approved copy");
    assert.equal(history.rows[0].snapshot.status, "approved");

    assert.equal((await save({ expectedRevision: 2, status: "approved" }, "reviewer")).rows[0].status, "approved");
    // A user cannot smuggle an approval into the same creative edit.
    assert.equal((await save({ expectedRevision: 3, body: "New copy", status: "approved" })).rows[0].status, "draft");
    const attempts = await Promise.all([
      save({ expectedRevision: 4, body: "Writer A" }),
      save({ expectedRevision: 4, body: "Writer B" }, "editor-b"),
    ]);
    assert.equal(attempts.reduce((n, result) => n + result.rows.length, 0), 1);
    assert.equal((await db.query("SELECT * FROM apsomh_content_revisions")).rows.length, 4);
    const clear = await save({ expectedRevision: 5, designDocument: null });
    assert.equal(clear.rows[0].design_document, null);
  } finally { await db.close(); }
});

test("document validation rejects unsupported versions, duplicate IDs and transient asset URLs", () => {
  assert.deepEqual(designDocumentSchema.parse(JSON.parse(JSON.stringify(document))), document);
  assert.equal(designDocumentSchema.safeParse({ ...document, schemaVersion: 2 }).success, false);
  assert.equal(designDocumentSchema.safeParse({ ...document, nodes: [...document.nodes, ...document.nodes] }).success, false);
  for (const src of ["blob:temporary", "javascript:alert(1)", "//external.example/image.png"]) {
    assert.equal(designDocumentSchema.safeParse({ ...document, background: { ...document.background, src } }).success, false);
  }
  assert.equal(designDocumentSchema.safeParse({ ...document, canvas: { w: 8192, h: 8192 } }).success, false);
  assert.equal(contentPatchSchema.safeParse({ body: "Missing revision" }).success, false);
  assert.equal(contentPatchSchema.safeParse({ expectedRevision: 1, owner: "someone else" }).success, false);
});

test("only existing editor roles may write shared content", () => {
  assert.equal(canEditContent("admin"), true);
  assert.equal(canEditContent("user"), true);
  assert.equal(canEditContent("viewer"), false);
  assert.equal(canEditContent("unknown"), false);
});

test("body limit covers chunked requests and counts UTF-8 bytes", async () => {
  assert.deepEqual(await readBoundedJson(new Request("https://local", { method: "POST", body: '{"text":"Grüezi"}' }), 100), { text: "Grüezi" });
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('"éééé"')); controller.close(); } });
  const req = new Request("https://local", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readBoundedJson(req, 8), /Payload too large/);
});

test("a document round-tripped through jsonb is not reported as an unsaved change", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE d (doc JSONB)`);
    await db.query(`INSERT INTO d (doc) VALUES ($1::jsonb)`, [JSON.stringify(document)]);
    const stored = (await db.query<{ doc: DesignDocument }>("SELECT doc FROM d")).rows[0].doc;

    // PostgreSQL stores jsonb in its own key order, so the plain serializations
    // differ even though nothing about the design changed. That is the trap the
    // dirty check in the canvas used to fall into: every saved design reopened
    // already marked as edited, arming the leave-site warning on every visit.
    assert.notEqual(JSON.stringify(stored), JSON.stringify(document));
    assert.deepEqual(stored, document);

    // canonicalDesign is what the canvas compares, and it must be blind to that.
    assert.equal(canonicalDesign(stored), canonicalDesign(document));

    // A real edit must still register.
    const edited = { ...document, canvas: { ...document.canvas, w: 1080 } };
    assert.notEqual(canonicalDesign(stored), canonicalDesign(edited));
  } finally {
    await db.close();
  }
});
