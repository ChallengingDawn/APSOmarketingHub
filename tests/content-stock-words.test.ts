import assert from "node:assert/strict";
import { test } from "node:test";
import { brandFlags } from "../src/lib/content/studio/kinds/banner/brand";

// Content v7 (10.11.2026): a banner's words never promise stock or delivery ("ab Lager" came back in sample words).
test("a banner's stock or delivery promise is stopped, in every shop language", () => {
  for (const t of ["NORMATEC O-Ringe aus NBR, ab Lager", "Sofort lieferbar", "Joints toriques en stock", "Pronta consegna", "Op voorraad", "In stock now"]) {
    assert.ok(brandFlags(t).some((f) => f.startsWith("No stock or delivery promises")), t);
  }
  assert.deepEqual(brandFlags("NORMATEC O-Ringe aus NBR in vielen Abmessungen"), []);
  assert.deepEqual(brandFlags("Lagerung und Pflege von O-Ringen"), []);
});
