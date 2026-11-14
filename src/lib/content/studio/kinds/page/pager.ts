// PAGE - THE PAGE PICKER'S PAGES (13.11.2026, SARCLA: "paginate on all 'Which page of the shop?'"). Pure:
// tests/content-page-picker-pager.test.ts. The list shows one page of 40 at a time with Previous, its numbers and Next,
// no longer "Show more" adding to the end.

/** How many pages the list has: from the total (the server counts up to 5,000), at least one past the page open when the
 * server says there are more. */
export function pagesOf(total: number, page: number, more: boolean, per: number): number {
  const counted = Math.ceil(Math.min(Math.max(0, total), 5000) / Math.max(1, per));
  return Math.max(page + (more ? 2 : 1), counted);
}

/** The page numbers shown (0-based): the first, the last, two each side of the one open - "…" where some are left out. */
export function pagerNumbers(page: number, pages: number): (number | "…")[] {
  const keep = new Set([0, pages - 1, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 0 && n < pages));
  const out: (number | "…")[] = [];
  let last = -1;
  for (const n of [...keep].sort((a, b) => a - b)) { if (n - last > 1) out.push("…"); out.push(n); last = n; }
  return out;
}
