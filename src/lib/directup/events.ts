// DIRECTUP - what one line of the tool's activity log means, in words (SARCLA, 14.10.2026: "I don't
// understand the log ... should be more specific"). The tool and the shop's bridge write short events with
// counts - "bridge:cart-after {added: 47, failed: 0}" - which only make sense with the code open. Each one is
// turned here into a sentence somebody in marketing can read: what happened, on which store view, with what
// result, and whether it is a problem. Never who the customer is: the events carry no names.
//
// Pure, so it is tested (tests/directup-events.test.ts): an event nobody described still shows, as itself.

export type Topic = "visit" | "cart" | "prices" | "files" | "other";
export type Tone = "ok" | "info" | "warn" | "bad";
export type Described = {
  topic: Topic;
  tone: Tone;
  /** What happened, in one line. */
  title: string;
  /** The figures and the why, in a second line. */
  detail: string;
  /** Happens on every visit and says little on its own - left out of the "Important" view. */
  routine: boolean;
  /** The article it is about, when there is one: its number and, from the catalogue copy, its name. */
  article?: { sku: string; name: string | null };
};

export const TOPICS: Record<Topic, string> = {
  visit: "Visits",
  cart: "Cart",
  prices: "Prices & quantities",
  files: "Files",
  other: "Other",
};

const FULL = new Intl.NumberFormat("en-US");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? FULL.format(Math.round(n)) : "?";
};
const count = (n: unknown, one: string, many: string) => `${num(n)} ${Number(n) === 1 ? one : many}`;
const size = (b: unknown) => {
  const n = Number(b) || 0;
  return n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};
const fileKind = (t: unknown) => {
  const s = String(t || "");
  if (/pdf/i.test(s)) return "PDF";
  if (/sheet|excel|xls/i.test(s)) return "Excel file";
  if (/csv/i.test(s)) return "CSV file";
  if (/image/i.test(s)) return "photo";
  if (/text/i.test(s)) return "text file";
  return "file";
};
const text = (v: unknown) => String(v ?? "").trim();
const sku = (v: unknown) => text(v) || "an article";

/** One event in words. `currentBridge` is the footer every store view should run; `product` is the name of the
 *  article the event names, when the gateway found it (SARCLA 14.10.2026: "would be great to have which product"). */
export function describe(ev: string, data: unknown, currentBridge: string, product: string | null = null): Described {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  // the catalogue copy's names end in " -" (the shop's own separator), which says nothing here
  const article = text(d.sku) ? { sku: text(d.sku), name: product ? product.replace(/\s*[-–]+\s*$/, "").trim() || null : null } : undefined;
  const ret = (topic: Topic, tone: Tone, title: string, detail = "", routine = false): Described =>
    article ? { topic, tone, title, detail, routine, article } : { topic, tone, title, detail, routine };

  switch (ev) {
    // ── visits ────────────────────────────────────────────────────────────
    case "hello": {
      // An older bridge is said once, at the top of the page (per store view); on every visit it would bury
      // the real problems - most such visits are ACC's.
      const bridge = text(d.bridge) || "unknown";
      return ret("visit", "info",
        `DirectUP opened on ${text(d.locale) || "an unknown store view"}`,
        `${d.loggedIn === false ? "Not signed in (yet)" : "Customer signed in"} · shop bridge ${bridge}${bridge !== currentBridge ? " (older)" : ""}`);
    }
    case "own":
      return ret("visit", "info",
        Number(d.count) > 0 ? `${count(d.count, "own article number", "own article numbers")} loaded` : "No own article numbers saved",
        "The customer's own numbers, kept in their shop account, which DirectUP recognises in a file", true);
    case "save":
      return d.ok
        ? ret("visit", "ok", "Customer saved an own article number", "Kept in their shop account for the next order")
        : ret("visit", "warn", "Saving an own article number failed", text(d.message) || text(d.why));
    case "save:all":
      return ret("visit", "ok", `Customer saved ${count(d.n, "own article number", "own article numbers")} at once`, "Kept in their shop account for the next order");

    // ── the cart ──────────────────────────────────────────────────────────
    case "cart": {
      const lines = Number(d.lines) || 0, added = Number(d.added) || 0, failed = Number(d.failed) || 0;
      const parts = [`${num(added)} went in`];
      if (failed) parts.push(`${num(failed)} refused by the shop`);
      if (lines - added - failed > 0) parts.push(`${num(lines - added - failed)} not sent`);
      parts.push(`in ${count(d.requests, "request", "requests")} to the shop`);
      if (d.login) parts.push("stopped: the shop asked for a sign-in");
      if (d.waited) parts.push("stopped waiting for the shop - its answer is still recorded if it comes");
      const tone: Tone = !added ? "bad" : failed || d.login || d.waited ? "warn" : "ok";
      return ret("cart", tone, `Add to cart: ${count(lines, "line", "lines")}`, parts.join(" · "));
    }
    case "bridge:add":
      return ret("cart", "info", `Sending ${count(d.lines, "line", "lines")} to the cart`, `${num(d.pieces)} pieces in all`);
    case "bridge:cart-before":
      return ret("cart", "info", `Cart before: ${count(d.count, "line", "lines")}`,
        "Read from the shop just before the lines went in, to see what the request adds", true);
    case "bridge:share": {
      const status = Number(d.status) || 0;
      if (d.login) return ret("cart", "bad", "The shop asked for a sign-in instead of adding the lines", "The customer's shop session had run out; they were offered the sign-in");
      if (status === 414) return ret("cart", "bad", "The request was too long for the shop (414)", "The tool sends the same lines again in two halves");
      if (status >= 400) return ret("cart", "bad", `The shop answered with an error (HTTP ${status})`, text(d.landed) ? `On ${text(d.landed)}` : "");
      return ret("cart", "ok", `The shop took the request${status ? ` (HTTP ${status})` : ""}`, text(d.landed) ? `It went on to ${text(d.landed)}` : "", true);
    }
    case "bridge:cart-after": {
      const added = Number(d.added) || 0, failed = Number(d.failed) || 0;
      const said = Array.isArray(d.messages) && d.messages.length ? `The shop said: ${text(d.messages[0])}` : "";
      if (!added && failed) return ret("cart", "bad", `Nothing went in: ${count(failed, "line", "lines")} refused`, said || "The shop gave no reason");
      if (failed) return ret("cart", "warn", `${count(added, "line", "lines")} added, ${num(failed)} refused`, said || "The shop gave no reason for the refused ones");
      return ret("cart", "ok", `${count(added, "line", "lines")} added to the cart`, `The cart now holds ${count(d.count, "line", "lines")}`);
    }
    case "bridge:minicart":
      return text(d.via) === "none"
        ? ret("cart", "warn", "The cart in the page header could not be refreshed", "The lines are in the cart; the header shows them after the next page load")
        : ret("cart", "info", "The cart in the page header was refreshed", "", true);
    case "bridge:bump":
      return ret("cart", "info", `The header's cart counter showed +${num(d.n)}`, d.shown === false ? "Could not be animated on this page" : "", true);
    case "bridge:error":
      return ret("cart", "bad", "Adding to the cart failed on the shop page", text(d.message));
    case "cart:split":
      return ret("cart", "warn", `The shop refused ${count(d.lines, "line", "lines")} in one request, without a reason`, "Sent again in two halves");
    case "cart:late":
      return ret("cart", "info", `The shop answered late: ${num(d.added)} of ${count(d.lines, "line", "lines")} went in`, "Recorded on the order list after all");
    case "added:fail":
      return ret("cart", "bad", "What went into the cart could not be written to the order list", text(d.msg));

    // ── prices and quantities (the shop's ERP) ───────────────────────────
    case "qty:erp": {
      // since 14.10.2026 the event carries the article, the quantity before and the unit; older ones only the new one
      const k = text(d.kind), unit = text(d.unit) ? ` ${text(d.unit)}` : "";
      const from = Number(d.from) > 0 ? ` from ${num(d.from)}` : "";
      const verb = k === "up" ? "raised" : "lowered";
      const why = k === "up" ? "The shop sells this article only from that quantity (a minimum or a pack size)"
        : k === "disc" ? "The article is being phased out and no more than that is left" : "The shop can deliver no more than that";
      return ret("prices", "info", `Quantity ${verb}${from} to ${num(d.to)}${unit}`, why, true);
    }
    case "qty:loop":
      return ret("prices", "warn", `Quantity kept switching between ${num(d.a)} and ${num(d.b)}`, "The shop's answers contradicted each other, so the tool stopped adjusting it");
    case "erp:late":
      return ret("prices", "warn", article ? "No answer from the shop's ERP" : `No answer from the shop's ERP for ${sku(d.sku)}`, "The price check took longer than 8 seconds; the line shows no price for now");
    case "erp:none":
      return ret("prices", "warn", "No price from the shop", "The shop answered without a price; the line reads \"Price on request\"");
    case "erp:noname":
      return ret("prices", "info", "No article name from the ERP", "Shown as \"Special article\": the shop's ERP route does not pass the name on", true);
    case "erp:unreadable":
      return ret("prices", "warn", "Unreadable answer from the shop", "The shop answered, but not with a price the tool could read");
    case "session:lost":
      return ret("prices", "bad", "The customer's shop session ran out",
        `${count(d.run, "article", "articles")} in a row came back without a price; the customer was asked to sign in again`);

    // ── files ─────────────────────────────────────────────────────────────
    case "bridge:drop":
      return ret("files", "info", `A ${fileKind(d.type)} was dropped on the shop page`, size(d.size));
    case "drop:page":
      return ret("files", "info", `DirectUP received the dropped ${fileKind(d.type)}`, size(d.size), true);
    case "bridge:drop-error":
      return ret("files", "bad", "A dropped file could not be handed to DirectUP", text(d.message));
    case "drop:unreadable":
      return ret("files", "bad", "A dropped file could not be read", text(d.msg));
    case "upload:fail": {
      const what = d.file ? "Reading the file failed" : "Reading the typed lines failed";
      const why = Number(d.status) ? `HTTP ${num(d.status)}${text(d.error) ? `: ${text(d.error)}` : ""}` : text(d.msg) || text(d.error);
      return ret("files", "bad", what, [why, Number(d.ms) ? `after ${(Number(d.ms) / 1000).toFixed(1)} s` : ""].filter(Boolean).join(" · "));
    }
    case "export":
      return ret("files", "ok", "Order list downloaded as Excel", count(d.lines, "line", "lines"));
    case "export:fail":
      return ret("files", "bad", "The Excel download failed", text(d.msg));

    case "clear:fail":
      return ret("other", "bad", "Emptying the order list failed", text(d.msg));
    default: {
      let raw = "";
      try { raw = data == null ? "" : JSON.stringify(data); } catch { raw = ""; }
      return ret("other", "info", ev || "(no name)", raw.slice(0, 200));
    }
  }
}
