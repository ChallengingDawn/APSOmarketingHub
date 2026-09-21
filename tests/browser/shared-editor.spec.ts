import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFile } from "node:fs/promises";
import type { DesignDocument } from "../../src/lib/design-document";

const secret = "local-browser-tests-only-not-a-production-secret";
const original: DesignDocument = {
  schemaVersion: 1, canvas: { w: 1200, h: 627 },
  background: { color: "#ffffff", gradientId: null, customGradient: { from: "#16303f", to: "#ed1b2f" }, src: null, scrim: 0 },
  nodes: [{ id: "headline", kind: "text", x: 70, y: 80, fill: "#274e64", text: "A shared APSO design", fontSize: 64, width: 1000 }],
};
const itemFixture = () => ({
  id: 1, channel: "linkedin", title: "Shared campaign", body: "Original copy", imageUrl: null as string | null,
  revision: 1, status: "approved", createdBy: "editor-a", updatedBy: null,
  createdAt: "2026-09-20T12:00:00Z", updatedAt: "2026-09-20T12:00:00Z", scheduledFor: null,
  hasDesign: true, designDocument: original,
});

test.beforeEach(async ({ context }) => {
  const token = await new SignJWT({ uid: 1, username: "editor-a", role: "user", typ: "session" })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  await context.addCookies([{ name: "apsomarketinghub_session", value: token, domain: "localhost", path: "/" }]);
});

test("save editable layers, reopen them, and export the same source", async ({ page }) => {
  let item = itemFixture();
  await page.route("**/api/content/1", async (route) => {
    if (route.request().method() === "PATCH") {
      const patch = route.request().postDataJSON();
      expect(patch.expectedRevision).toBe(item.revision);
      item = { ...item, ...patch, revision: item.revision + 1, status: "draft" };
    }
    await route.fulfill({ json: { item } });
  });
  await page.goto("/editor?item=1");
  await expect(page.getByRole("button", { name: "Save design", exact: true })).toBeVisible();
  const edited = { ...original, nodes: [{ ...original.nodes[0], text: "Edited by a teammate", rotation: 3 }] };
  await page.locator('input[accept="application/json,.json"]').setInputFiles({ name: "design.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(edited)) });
  await expect(page.getByText("Unsaved design changes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(page.getByText(/Design saved as version 2/)).toBeVisible();
  expect(item.designDocument).toEqual(edited);
  await page.reload();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download editable source" }).click();
  const download = await pending;
  expect(JSON.parse(await readFile((await download.path())!, "utf8"))).toEqual(edited);
  await page.screenshot({ path: "test-results/shared-canvas.png", fullPage: true });
});

test("Library copy edits stay available after a conflict", async ({ page }) => {
  const item = itemFixture();
  await page.route("**/api/content?*", (route) => route.fulfill({ json: { items: [item] } }));
  await page.route("**/api/content/1", (route) => route.fulfill({ status: 409, json: { error: "Someone saved a newer version. Your changes are still here." } }));
  await page.goto("/library?item=1");
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await page.getByLabel("Content", { exact: true }).fill("Keep my unsaved translation draft");
  await page.getByRole("button", { name: "Save text", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Someone saved a newer version");
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue("Keep my unsaved translation draft");
});

test("Library saves edited copy as a new draft revision", async ({ page }) => {
  let item = itemFixture();
  await page.route("**/api/content?*", (route) => route.fulfill({ json: { items: [item] } }));
  await page.route("**/api/content/1", async (route) => {
    const patch = route.request().postDataJSON();
    expect(patch.expectedRevision).toBe(1);
    item = { ...item, ...patch, revision: 2, status: "draft" };
    await route.fulfill({ json: { item } });
  });
  await page.goto("/library?item=1");
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await page.getByLabel("Content", { exact: true }).fill("## Reviewed headline\n\nUpdated campaign copy.");
  await page.getByRole("button", { name: "Save text", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Saved as version 2");
  await expect(page.getByText("Reviewed headline", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/library-editor.png", fullPage: true });
});
