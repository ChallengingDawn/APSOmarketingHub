// A STUDIO DOCUMENT AND THE SMALL CHANGES THAT SAVE IT (08.11.2026: each kind of content has its own studio).
//
// A to-do's studio keeps one JSON document per piece (a newsletter's blocks, a post's text per network, a video's scenes).
// It is never sent whole: the hub sits behind a firewall that refuses a request body over 8 KB with a bare 403, and two
// people may be in one studio. So the studio sends what changed - "set this field", "insert this block" - in batches
// under the limit, a long text in slices; the server lays them over the document as it is now, so two people changing
// two different fields both keep their change.
// Pure: no database, no fetch - tests/studio-doc.test.ts.

export type Path = (string | number)[];
export type Op =
  | { op: "set"; path: Path; value: unknown }
  | { op: "append"; path: Path; value: string }
  | { op: "insert"; path: Path; index: number; value: unknown }
  | { op: "remove"; path: Path; index: number }
  | { op: "move"; path: Path; from: number; to: number };

/** The most a studio document may weigh, stored. */
export const DOC_MAX_BYTES = 900_000;
/** The most one request may carry - under the firewall's 8 KB with room for the envelope. */
export const BATCH_MAX_BYTES = 6_500;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const badKey = (k: string | number) => k === "__proto__" || k === "constructor" || k === "prototype";

/** The container a path ends in, made where it is missing; null when the path runs through something else. */
function parentOf(root: unknown, path: Path, make: boolean): { holder: Record<string, unknown> | unknown[]; key: string | number } | null {
  if (!path.length) return null;
  let cur: unknown = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (badKey(k)) return null;
    const next = Array.isArray(cur) ? (typeof k === "number" ? cur[k] : undefined) : isObj(cur) ? cur[String(k)] : undefined;
    if (next === undefined || next === null) {
      if (!make || !isObj(cur)) return null;
      const made = typeof path[i + 1] === "number" ? [] : {};
      cur[String(k)] = made;
      cur = made;
    } else cur = next;
  }
  const key = path[path.length - 1];
  if (badKey(key)) return null;
  if (Array.isArray(cur) && typeof key === "number") return { holder: cur, key };
  if (isObj(cur)) return { holder: cur, key: String(key) };
  return null;
}

const at = (root: unknown, path: Path): unknown => {
  let cur = root;
  for (const k of path) {
    if (Array.isArray(cur) && typeof k === "number") cur = cur[k];
    else if (isObj(cur)) cur = cur[String(k)];
    else return undefined;
  }
  return cur;
};

/** The document with the changes laid over it, in order. A change that no longer fits (its block is gone) is skipped. */
export function applyOps<T>(doc: T, ops: Op[]): T {
  const root = clone(doc) as unknown;
  for (const o of ops) {
    if (o.op === "set" || o.op === "append") {
      if (!o.path.length) continue;
      const p = parentOf(root, o.path, true);
      if (!p) continue;
      const cur = Array.isArray(p.holder) ? p.holder[p.key as number] : (p.holder as Record<string, unknown>)[p.key as string];
      const value = o.op === "append" ? `${typeof cur === "string" ? cur : ""}${o.value}` : clone(o.value);
      if (Array.isArray(p.holder)) { if ((p.key as number) <= p.holder.length) p.holder[p.key as number] = value; }
      else p.holder[p.key as string] = value;
      continue;
    }
    const list = at(root, o.path);
    if (!Array.isArray(list)) continue;
    if (o.op === "insert") list.splice(Math.max(0, Math.min(o.index, list.length)), 0, clone(o.value));
    else if (o.op === "remove") { if (o.index >= 0 && o.index < list.length) list.splice(o.index, 1); }
    else if (o.from >= 0 && o.from < list.length && o.to >= 0 && o.to < list.length) list.splice(o.to, 0, list.splice(o.from, 1)[0]);
  }
  return root as T;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The changes from one document to the next, as small as they come: a field that changed is set on its own; a list that
 * only changed inside its items is gone into; a list that grew, shrank or moved is set whole.
 */
export function diffOps(prev: unknown, next: unknown, path: Path = []): Op[] {
  if (same(prev, next)) return [];
  if (isObj(prev) && isObj(next)) {
    const out: Op[] = [];
    for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (!(k in next)) { out.push({ op: "set", path: [...path, k], value: null }); continue; }
      out.push(...diffOps(prev[k], next[k], [...path, k]));
    }
    return out;
  }
  if (Array.isArray(prev) && Array.isArray(next) && prev.length === next.length) {
    return next.flatMap((v, i) => diffOps(prev[i], v, [...path, i]));
  }
  if (!path.length) return [{ op: "set", path: ["$root"], value: next }];
  return [{ op: "set", path, value: next }];
}

const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/**
 * The changes in batches that each fit one request. A change too big alone - a long text - is sent as its start, then
 * slices appended to it.
 */
export function batches(ops: Op[], max = BATCH_MAX_BYTES): Op[][] {
  const flat: Op[] = [];
  for (const o of ops) {
    if (size(o) <= max) { flat.push(o); continue; }
    if ((o.op === "set" || o.op === "append") && typeof o.value === "string") {
      const step = Math.max(500, Math.floor(max / 4));
      const s = o.value;
      flat.push({ op: o.op, path: o.path, value: s.slice(0, step) });
      for (let i = step; i < s.length; i += step) flat.push({ op: "append", path: o.path, value: s.slice(i, i + step) });
      continue;
    }
    if (o.op === "set" && (isObj(o.value) || Array.isArray(o.value))) {
      // a big object: its fields one by one (an array: emptied, then its items set in place)
      if (Array.isArray(o.value)) {
        flat.push({ op: "set", path: o.path, value: [] });
        o.value.forEach((v, i) => flat.push(...batches([{ op: "insert", path: o.path, index: i, value: v }], max).flat()));
      } else {
        flat.push({ op: "set", path: o.path, value: {} });
        for (const [k, v] of Object.entries(o.value)) flat.push(...batches([{ op: "set", path: [...o.path, k], value: v }], max).flat());
      }
      continue;
    }
    flat.push(o); // an insert of one huge item: the server refuses it with a clear message
  }
  const out: Op[][] = [];
  let cur: Op[] = [];
  let bytes = 0;
  for (const o of flat) {
    const n = size(o);
    if (cur.length && bytes + n > max) { out.push(cur); cur = []; bytes = 0; }
    cur.push(o);
    bytes += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** The ops a request may carry: well-formed, each path short and plain. Anything else is refused whole. */
export function cleanOps(raw: unknown): Op[] | null {
  if (!Array.isArray(raw) || raw.length > 400) return null;
  const okPath = (p: unknown): p is Path => Array.isArray(p) && p.length <= 12 && p.every((k) => (typeof k === "string" && k.length <= 80 && !badKey(k)) || (Number.isInteger(k) && (k as number) >= 0 && (k as number) < 5000));
  const out: Op[] = [];
  for (const r of raw) {
    if (!isObj(r) || !okPath(r.path)) return null;
    if (r.op === "set") out.push({ op: "set", path: r.path, value: r.value });
    else if (r.op === "append" && typeof r.value === "string") out.push({ op: "append", path: r.path, value: r.value });
    else if (r.op === "insert" && Number.isInteger(r.index)) out.push({ op: "insert", path: r.path, index: r.index as number, value: r.value });
    else if (r.op === "remove" && Number.isInteger(r.index)) out.push({ op: "remove", path: r.path, index: r.index as number });
    else if (r.op === "move" && Number.isInteger(r.from) && Number.isInteger(r.to)) out.push({ op: "move", path: r.path, from: r.from as number, to: r.to as number });
    else return null;
  }
  return out;
}

/** "$root" set = the whole document replaced (diffOps of two different kinds of thing). */
export function applyWithRoot<T>(doc: T, ops: Op[]): T {
  let cur = doc;
  for (const o of ops) cur = o.op === "set" && o.path.length === 1 && o.path[0] === "$root" ? (clone(o.value) as T) : applyOps(cur, [o]);
  return cur;
}
