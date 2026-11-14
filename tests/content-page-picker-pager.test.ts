import assert from "node:assert/strict";
import { test } from "node:test";
import { pagerNumbers, pagesOf } from "../src/lib/content/studio/kinds/page/pager";

// SARCLA 13.11.2026: "paginate on all 'Which page of the shop?'" - one page of 40 at a time, its numbers shown.

test("the list's pages: from the total, capped at the server's 5,000; one more when the server says there are more", () => {
  assert.equal(pagesOf(0, 0, false, 40), 1);
  assert.equal(pagesOf(40, 0, false, 40), 1);
  assert.equal(pagesOf(41, 0, true, 40), 2);
  assert.equal(pagesOf(1234, 0, true, 40), 31);
  assert.equal(pagesOf(9000, 0, true, 40), 125);
  assert.equal(pagesOf(5000, 124, true, 40), 126, "the 5,000 cap: a full last page still offers Next");
});

test("the page numbers: the first, the last, two each side of the open one, gaps said once", () => {
  assert.deepEqual(pagerNumbers(0, 1), [0]);
  assert.deepEqual(pagerNumbers(0, 5), [0, 1, 2, "…", 4]);
  assert.deepEqual(pagerNumbers(0, 4), [0, 1, 2, 3]);
  assert.deepEqual(pagerNumbers(10, 31), [0, "…", 8, 9, 10, 11, 12, "…", 30]);
  assert.deepEqual(pagerNumbers(30, 31), [0, "…", 28, 29, 30]);
  assert.deepEqual(pagerNumbers(3, 31), [0, 1, 2, 3, 4, 5, "…", 30]);
});
