// CODING AN ANSWER FOR THE SANDBOX - a HubSpot answer or a set of database rows, field by field (policy.ts), and then
// the leak check: every real value replaced on the way (and its own longer words) is looked for in the whole coded
// answer; one hit anywhere and the answer is not sent. Pure - the feeder (feeder.ts) runs it, the tests pin it.

import {
  codeOf, fieldKind, isHiddenMoney, leakNeedles, placeholderText, scaleMoney, PUBLIC_MAIL_DOMAINS,
} from "./policy";

export type RecordKind = "company" | "contact" | "owner" | "user" | "record" | "product" | "config" | "assoc" | "rows";

export type CodeCtx = {
  salt: string;
  factor: number;
  /** HubSpot's type for a property of the object being coded ("enumeration", "number", "string", ...), when known. */
  propType?: (prop: string) => string | undefined;
};

type Rec = { kind: RecordKind; id?: string; row?: Record<string, unknown> };

const KEEP_TYPES = new Set(["enumeration", "bool", "booleancheckbox", "number", "date", "datetime"]);
const EMAIL_IN = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const PHONE_IN = /(?:\+|00)\d[\d\s/().-]{7,}\d/g;

/** What a HubSpot path answers about: decides how names are coded and whose property types apply. */
export function kindOfPath(path: string): { kind: RecordKind; objectType?: string } {
  const p = path.split("?")[0].toLowerCase();
  if (p.includes("/associations")) return { kind: "assoc" };
  if (/^\/crm\/v3\/owners/.test(p)) return { kind: "owner" };
  if (/^\/settings\/v3\/users/.test(p)) return { kind: "user" };
  if (/^\/(crm\/v3\/(properties|pipelines|schemas|lists)|automation\/|account-info\/)/.test(p)) return { kind: "config" };
  const m = /^\/crm\/v[34]\/objects\/([^/]+)/.exec(p);
  if (m) {
    const t = m[1];
    if (t === "companies" || t === "0-2") return { kind: "company", objectType: "companies" };
    if (t === "contacts" || t === "0-1") return { kind: "contact", objectType: "contacts" };
    if (t === "products" || t === "line_items" || t === "0-7" || t === "0-8") return { kind: "product", objectType: t };
    return { kind: "record", objectType: t };
  }
  return { kind: "record" };
}

const isCodeLike = (s: string) => s.length <= 60 && s.trim().split(/\s+/).length <= 4 && !s.includes("@");

const ID_COLUMNS: Record<"company" | "contact" | "owner", RegExp> = {
  company: /^(company_?id|hs_company_id|companyid|associatedcompanyid|company_hs_id)$/i,
  contact: /^(contact_?id|hs_contact_id|contactid|vid)$/i,
  owner: /^(owner_?id|hubspot_owner_id|ownerid|hs_owner_id)$/i,
};

function linkedId(row: Record<string, unknown> | undefined, which: keyof typeof ID_COLUMNS): string | undefined {
  if (!row) return undefined;
  for (const [k, v] of Object.entries(row)) if (ID_COLUMNS[which].test(k) && v !== null && v !== undefined && v !== "") return String(v);
  return undefined;
}

function codedName(key: string, value: string, rec: Rec, ctx: CodeCtx): string {
  const k = key.toLowerCase().replace(/_/g, "");
  if (rec.kind === "company" && rec.id) return `Company ${rec.id}`;
  if (rec.kind === "contact" && rec.id) return k === "firstname" ? "Contact" : k === "lastname" ? rec.id : `Contact ${rec.id}`;
  if ((rec.kind === "owner" || rec.kind === "user") && rec.id) return k === "firstname" ? "Owner" : k === "lastname" ? rec.id : `Owner ${rec.id}`;
  if (rec.kind === "record" && rec.id) return `Record ${rec.id}`;
  if (rec.kind === "rows") {
    if (/owner/.test(k)) { const id = linkedId(rec.row, "owner"); if (id) return `Owner ${id}`; }
    if (/contact|person|buyer|first|last|full/.test(k)) { const id = linkedId(rec.row, "contact"); if (id) return `Contact ${id}`; }
    const id = linkedId(rec.row, "company");
    if (id && /company|customer|^name$/.test(k)) return `Company ${id}`;
  }
  return `Name ${codeOf(ctx.salt, value)}`;
}

function codedEmail(value: string, rec: Rec, ctx: CodeCtx): string {
  if (rec.kind === "contact" && rec.id) return `c${rec.id}@example.invalid`;
  if ((rec.kind === "owner" || rec.kind === "user") && rec.id) return `o${rec.id}@example.invalid`;
  return `x${codeOf(ctx.salt, value)}@example.invalid`;
}

export class Coder {
  readonly originals = new Set<string>();
  constructor(private readonly ctx: CodeCtx) {}

  private remember(v: string) { for (const n of leakNeedles(v)) this.originals.add(n); }

  /** A string that stays: e-mail addresses and phone numbers inside it are still taken out. */
  private sweep(s: string): string {
    return s
      .replace(EMAIL_IN, (m) => { this.remember(m); this.remember(m.split("@")[1]); return `x${codeOf(this.ctx.salt, m)}@example.invalid`; })
      .replace(PHONE_IN, "[phone]");
  }

  field(key: string, v: unknown, rec: Rec): unknown {
    if (v === null || v === undefined) return v;
    if (typeof v === "object") return this.walk(v, rec);
    if (rec.kind === "assoc") return v;
    if (rec.kind === "config") return typeof v === "string" ? this.sweep(v) : v;
    const kind = fieldKind(key);
    // a phone number stored as digits is still a phone number
    if (kind === "phone" || kind === "address" || kind === "social") { if (typeof v === "string") this.remember(v); return null; }
    if (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))) {
      return isHiddenMoney(key) ? scaleMoney(v, this.ctx.factor) : v;
    }
    if (typeof v !== "string") return v;
    const type = this.ctx.propType?.(key);
    if (type && KEEP_TYPES.has(type) && kind !== "email") return this.sweep(v);
    if (type === "phone_number") { this.remember(v); return null; }
    switch (kind) {
      case "email": this.remember(v); if (v.includes("@")) this.remember(v.split("@")[1]); return codedEmail(v, rec, this.ctx);
      case "domain": {
        const d = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
        if (PUBLIC_MAIL_DOMAINS.has(d)) return v;
        this.remember(d);
        return `d${codeOf(this.ctx.salt, d)}.example.invalid`;
      }
      case "name":
        if (rec.kind === "product") return this.sweep(v);
        this.remember(v);
        return codedName(key, v, rec, this.ctx);
      case "text":
        return placeholderText(this.ctx.salt, v);
      default:
        // a field no rule names: a short code-like value (a stage, a code, a flag) stays; free words do not
        return isCodeLike(v) ? this.sweep(v) : placeholderText(this.ctx.salt, v);
    }
  }

  walk(v: unknown, rec: Rec): unknown {
    if (Array.isArray(v)) return v.map((x) => this.walk(x, rec));
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    // inside a record (an owner's teams, a record's association lists): its setup, not another person or customer -
    // kept, and still swept for addresses and numbers
    if (rec.id !== undefined && rec.kind !== "rows" && rec.kind !== "config" && rec.kind !== "assoc") rec = { kind: "config" };
    // a CRM record: its properties are coded with its own id
    if ("properties" in o && o.properties && typeof o.properties === "object" && !Array.isArray(o.properties) && "id" in o && rec.kind !== "config") {
      const own: Rec = { kind: rec.kind, id: String(o.id) };
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(o)) {
        if (k === "properties") {
          out[k] = Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([pk, pv]) => [pk, this.field(pk, pv, own)]));
        } else if (k === "propertiesWithHistory") {
          out[k] = Object.fromEntries(Object.entries(x as Record<string, unknown[]>).map(([pk, hist]) => [pk,
            (hist ?? []).map((h) => ({ ...(h as object), value: this.field(pk, (h as { value?: unknown }).value, own) }))]));
        } else {
          out[k] = this.field(k, x, own);
        }
      }
      return out;
    }
    // an owner or a user: a flat object with its id
    // a row's names are coded by the ids beside them: in a JSON column, its own ids first, then the row's
    const here: Rec = (rec.kind === "owner" || rec.kind === "user") && "id" in o ? { kind: rec.kind, id: String(o.id) }
      : rec.kind === "rows" ? { kind: "rows", row: { ...(rec.row ?? {}), ...o } } : rec;
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, this.field(k, x, here)]));
  }
}

export type LeakResult = { ok: true } | { ok: false; path: string };

/** One real value (or a longer word of it) anywhere in the coded answer = a leak; the path says where, never what. */
export function leakCheck(coded: unknown, originals: Set<string>): LeakResult {
  if (!originals.size) return { ok: true };
  const strings: { path: string; s: string }[] = [];
  const collect = (v: unknown, path: string) => {
    if (typeof v === "string") strings.push({ path, s: v.toLowerCase() });
    else if (Array.isArray(v)) v.forEach((x, i) => collect(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) collect(x, path ? `${path}.${k}` : k);
  };
  collect(coded, "");
  const all = strings.map((x) => x.s).join("\u0000");
  for (const needle of originals) {
    if (!all.includes(needle)) continue;
    const at = strings.find((x) => x.s.includes(needle));
    return { ok: false, path: (at?.path ?? "?").replace(/\[\d+\]/g, "[]") };
  }
  return { ok: true };
}

/** A HubSpot answer for the sandbox: the body coded, or - for an error - only its status (messages can echo values). */
export function codeHubspotAnswer(path: string, status: number, body: unknown, ctx: CodeCtx):
  { response: { status: number; body: unknown } } | { refused: string } {
  if (status < 200 || status >= 300) return { response: { status, body: { status: "error", message: `HubSpot answered ${status}` } } };
  const { kind } = kindOfPath(path);
  const coder = new Coder(ctx);
  const coded = coder.walk(body, { kind });
  const leak = leakCheck(coded, coder.originals);
  return leak.ok ? { response: { status, body: coded } } : { refused: `leak check: a real value survived in ${leak.path}` };
}

/** Database rows for the sandbox, coded row by row (names by the ids beside them). */
export function codeRows(rows: unknown[], ctx: CodeCtx): { response: { rows: unknown[] } } | { refused: string } {
  const coder = new Coder(ctx);
  const coded = rows.map((r) => coder.walk(r, { kind: "rows" }));
  const leak = leakCheck(coded, coder.originals);
  return leak.ok ? { response: { rows: coded } } : { refused: `leak check: a real value survived in ${leak.path}` };
}
