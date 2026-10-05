// What a customer ordered in a window, article by article - and WHICH order it
// was. Kept apart from the HubSpot read so it can be tested.
//
// SARCLA, 05.10: an ordered line said only article, quantity and value. Rubix
// placed one web order of fifteen lines and the panel showed fifteen rows with
// no date, no order and no person - "missed a lot of information". Every row
// now carries the order it came from: the day, the number (a link), and who
// placed it.
//
// An order counts ONCE. HubSpot holds an order as placed (.000) and each
// delivery (.001, .002 ...) as separate records; summing them doubled the
// quantity and the value of every delivered line. Per article the delivered
// figure is taken, unless the order as placed is larger (not all of it has gone
// out yet) - the same rule as the Articles report.

export type OrderDoc = {
  /** The HubSpot record id. */
  id: string;
  /** "A1234567.000" as placed, ".001" and up for the deliveries. */
  number: string | null;
  /** The shop's own number - all a new web order has until the ERP gives it one. */
  web: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  eshop: boolean;
  /** "A# | Person | Company" - the person is the order's own reference. */
  title: string | null;
  /** A contact associated with this record, if any. */
  contactId: string | null;
  /** The billing e-mail, when the shop wrote one. */
  email: string | null;
  lines: { article: string; text: string | null; qty: number; revenue: number }[];
};

/** The order a line came from - for the date, the link and the person. */
export type OrderRef = {
  id: string;
  /** The order number without its document suffix, e.g. "A1234567". */
  number: string | null;
  /** The shop's order number, for an order the ERP has not numbered yet. */
  web: string | null;
  date: string | null;
  contactId: string | null;
  /** Who placed it when there is no contact record: the reference or the e-mail. */
  person: string | null;
};

export type OrderedLine = {
  article: string;
  description: string | null;
  qty: number;
  revenue: number;
  /** Orders in the window that carried it - an order, not a document. */
  orders: number;
  /** Ordered through the webshop. Such an order went through the cart and a
   *  login by construction - it cannot be placed any other way. */
  eshop: boolean;
  /** The most recent of those orders. */
  last: OrderRef | null;
};

export const baseNumber = (no: string): string => no.trim().replace(/\.\d{3}$/, "");

/** The person between the bars of "A# | Person | Company"; null on any other shape. */
export function personFromTitle(title: string | null | undefined): string | null {
  const parts = String(title ?? "").split("|").map((s) => s.trim());
  return parts.length >= 3 && parts[1] ? parts[1] : null;
}

type Sum = { qty: number; revenue: number; text: string | null };

function sumLines(docs: OrderDoc[]): Map<string, Sum> {
  const m = new Map<string, Sum>();
  for (const d of docs) for (const l of d.lines) {
    const a = m.get(l.article);
    if (a) { a.qty += l.qty; a.revenue += l.revenue; a.text ||= l.text; }
    else m.set(l.article, { qty: l.qty, revenue: l.revenue, text: l.text });
  }
  return m;
}

export function mergeOrderLines(docs: OrderDoc[]): OrderedLine[] {
  const groups = new Map<string, OrderDoc[]>();
  for (const d of docs) {
    const k = d.number ? baseNumber(d.number) : `#${d.id}`;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }

  const byArticle = new Map<string, OrderedLine>();
  for (const [base, group] of groups) {
    const placed = group.filter((d) => d.number?.trim().endsWith(".000"));
    const delivered = group.filter((d) => !d.number?.trim().endsWith(".000"));
    let lines: Map<string, Sum>;
    if (placed.length && delivered.length) {
      const p = sumLines(placed), dl = sumLines(delivered);
      lines = new Map();
      for (const art of new Set([...p.keys(), ...dl.keys()])) {
        const a = p.get(art), b = dl.get(art);
        const take = !b ? a! : !a ? b : (a.revenue > b.revenue && a.revenue >= 0 ? a : b);
        lines.set(art, { ...take, text: a?.text || b?.text || null });
      }
    } else {
      lines = sumLines(group);
    }

    // The order's day is the day it was placed; its person is wherever it
    // survived - an archived .000 takes its associations with it, so the
    // contact can sit on the delivery instead.
    const head = placed[0] ?? group[0];
    const ref: OrderRef = {
      id: head.id,
      number: base.startsWith("#") ? null : base,
      web: group.map((d) => d.web).find(Boolean) ?? null,
      date: head.date ?? group.find((d) => d.date)?.date ?? null,
      contactId: group.map((d) => d.contactId).find(Boolean) ?? null,
      person: group.map((d) => personFromTitle(d.title)).find(Boolean)
        ?? group.map((d) => d.email).find(Boolean) ?? null,
    };
    const eshop = group.some((d) => d.eshop);

    for (const [article, l] of lines) {
      const cur = byArticle.get(article)
        ?? { article, description: null, qty: 0, revenue: 0, orders: 0, eshop: false, last: null };
      cur.orders += 1;
      cur.qty += l.qty;
      cur.revenue += l.revenue;
      cur.description ??= l.text || null;
      cur.eshop ||= eshop;
      if (!cur.last || (ref.date ?? "") > (cur.last.date ?? "")) cur.last = ref;
      byArticle.set(article, cur);
    }
  }
  return [...byArticle.values()].sort((a, b) => b.revenue - a.revenue);
}
