"use client";
// PICK A PAGE OF THE SHOP (08.11.2026) - shown big, in the middle of the studio, where the page will be.
// SARCLA 08.11.2026: "the list is not loading; [it should be] sizeable, it should be visible". So: the whole middle
// column, a search that answers as it is typed (every word in the page's address, or a product number), the store
// views and kinds as squared choices, the pages AI testing & personalization already works on first, 40 pages at a
// time with "Show more", and a clear way out when something does not answer (a message and "Try again", never a
// spinner that runs forever). An address can be typed or pasted too.
// Content v8 (SARCLA 10.11.2026 point 7: "Page builder i can't select acc"): the environment comes first - Production |
// ACC, squared, above STORE. ACC lists ACC's own pages (a row says when production has no such page; "Only on ACC" lists
// those alone), opens them from acc.apsoparts.com, and the to-do works on ACC from then on (../../../../lib/content/studio/
// kinds/page/env.ts). Another store view's page of the same to-do is picked in the to-do's own environment.

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import SearchIcon from "@mui/icons-material/Search";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { KIND_LABEL, type Env, type PageKind } from "@/lib/convert/model";
import { pathInfo } from "@/lib/content/studio/kinds/page/model";
import { ENV_HOST, ENV_LABEL, ENV_OPTIONS, pickedEnv, rowNote, storesFor, typedPath as typedPathOf } from "@/lib/content/studio/kinds/page/env";
import type { PageRow } from "@/lib/content/studio/kinds/page/shop";
import { pagerNumbers, pagesOf } from "@/lib/content/studio/kinds/page/pager";
import { PINK, btn, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Chip, Choice } from "./ui";

export type Picked = { env: Env; path: string; store: string | null; kind: PageKind };
/** A NEW page asked for here (SARCLA 13.11.2026: "allow to create a new page, not only editing existing one, and create
 * from AI prompt from user"): what it should be (empty = start empty and add the blocks by hand), its store view and
 * environment as chosen in the picker. */
export type NewAsked = { prompt: string; store: string; env: Env };

/** The new page's card at the top of the picker: say what the page is, the AI builds it - or start it empty. */
function NewPageCard({ store, env, ai, onNew }: { store: string; env: Env; ai: boolean; onNew: (n: NewAsked) => void }) {
  const [want, setWant] = useState("");
  const go = (prompt: string) => onNew({ prompt: prompt.trim(), store, env });
  return (
    <Box data-new-page-card sx={{ mb: 2.5, p: 2, borderRadius: "12px", border: "1px solid rgba(194,44,110,.22)", background: "linear-gradient(135deg, rgba(194,44,110,.06), rgba(36,89,209,.05))" }}>
      <Typography sx={{ fontSize: "1rem", fontWeight: 750, color: INK }}>A new page</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.25, mb: 1.25 }}>
        Say what it is about and for whom: the AI builds it with its blocks and modules, in {store} on {env === "acc" ? "ACC" : "production"}. You change everything after, on the page.
      </Typography>
      <TextField fullWidth multiline minRows={2} maxRows={8} size="small" value={want} onChange={(e) => setWant(e.target.value)}
        placeholder={"e.g. Black Friday: our best-selling O-rings, plastic bars and APSOvib buffers, for maintenance buyers - the campaign's photos, a customer quote, the code after login"}
        sx={{ ...field, mb: 1, "& .MuiInputBase-root": { bgcolor: "#fff", fontSize: "0.92rem" } }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ai && want.trim()) go(want); }} />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Button variant="contained" disableElevation disabled={!ai || !want.trim()} onClick={() => go(want)} startIcon={<AutoAwesomeOutlinedIcon />}
          sx={{ ...btn, bgcolor: PINK, borderRadius: "8px", height: 40, px: 2, "&:hover": { bgcolor: "#a3245c" } }}>
          Build it with AI
        </Button>
        <Button variant="outlined" onClick={() => go("")} startIcon={<AddIcon />}
          sx={{ ...btn, borderRadius: "8px", height: 40, px: 2, color: INK, borderColor: HAIRLINE, bgcolor: "#fff", "&:hover": { borderColor: PINK, bgcolor: "#fff" } }}>
          Start empty
        </Button>
        {!ai && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The AI is not set up here: start empty and add the blocks.</Typography>}
      </Box>
    </Box>
  );
}
type Found = { rows: PageRow[]; total: number; more: boolean };
type StoreCount = { store: string; prod: number; acc: number };

const KINDS: { key: "all" | PageKind; label: string }[] = [
  { key: "all", label: "All" }, { key: "cms", label: "CMS pages" }, { key: "category", label: "Categories" }, { key: "product", label: "Products" }, { key: "home", label: "Home" },
];
const STORE_ORDER = ["de-CH", "fr-CH", "it-CH", "en-INT", "fr-FR", "it-IT", "nl-NL", "pl-PL"];
const storeRank = (s: string) => (STORE_ORDER.indexOf(s) < 0 ? 99 : STORE_ORDER.indexOf(s));

/** The pages one screen of the list holds (the server's perPage for "pages", ../../../../lib/content/studio/kinds/page/server.ts). */
const PER_PAGE = 40;

/** The list's pages (SARCLA 13.11.2026: "paginate on 'Which page of the shop?'"): Previous, the numbers, Next. */
export function Pager({ page, pages, busy, onGo }: { page: number; pages: number; busy: boolean; onGo: (n: number) => void }) {
  if (pages <= 1) return null;
  const num = (n: number) => (
    <Button key={n} size="small" disabled={busy && n !== page} onClick={() => { if (n !== page) onGo(n); }} aria-current={n === page ? "page" : undefined}
      sx={{ ...btn, minWidth: 34, height: 32, px: 1, borderRadius: "6px", fontVariantNumeric: "tabular-nums", color: n === page ? "#fff" : INK, bgcolor: n === page ? PINK : "transparent", "&:hover": { bgcolor: n === page ? PINK : "rgba(36,89,209,.06)" } }}>
      {n + 1}
    </Button>
  );
  return (
    <Box data-pager sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, flexWrap: "wrap", p: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
      <Button size="small" disabled={busy || page === 0} onClick={() => onGo(page - 1)} sx={{ ...btn, height: 32, color: INK }}>‹ Previous</Button>
      {pagerNumbers(page, pages).map((n, i) => (n === "…" ? <Typography key={`gap${i}`} sx={{ px: 0.5, color: MUTED, fontSize: "0.85rem" }}>…</Typography> : num(n)))}
      <Button size="small" disabled={busy || page >= pages - 1} onClick={() => onGo(page + 1)} sx={{ ...btn, height: 32, color: INK }}>Next ›</Button>
    </Box>
  );
}

/** A typed address as a path on the shop: a full address of production or ACC, or a path. */
const typedPath = (raw: string) => typedPathOf(raw, (p) => !!pathInfo(p));

/** A page's name as people read it: "o ring selection guide" -> "O ring selection guide". */
const nice = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function Row({ r, onPick, current }: { r: PageRow; onPick: (r: PageRow) => void; current: boolean }) {
  return (
    <Box component="button" type="button" onClick={() => onPick(r)} sx={{
      all: "unset", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 1.5, alignItems: "center", width: "100%", cursor: "pointer",
      px: 2, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: current ? "rgba(194,44,110,.06)" : "transparent",
      "&:hover": { bgcolor: "rgba(36,89,209,.05)" }, "&:hover .go": { opacity: 1 }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: -2 },
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nice(r.name)}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "ui-monospace, Consolas, monospace" }}>{r.path}</Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
        {rowNote(r) && <Chip tint="amber">Only on ACC</Chip>}
        {r.convert && <Chip tint={r.convert.status === "approved" ? "green" : "purple"}>{r.convert.status === "approved" ? "Approved version" : "Draft version"}</Chip>}
        <Chip tint="slate">{KIND_LABEL[r.kind]}</Chip>
        <Chip tint="blue">{r.store}</Chip>
        <NorthEastIcon className="go" sx={{ fontSize: 16, color: PINK, opacity: 0, transition: "opacity .15s" }} />
      </Box>
    </Box>
  );
}

export function PagePicker({ api, store: storeIn, lockStore, env: envIn, lockEnv, current, onPick, onClose, title, onNew, ai }: {
  api: StudioApi; store?: string; lockStore?: boolean;
  /** the environment shown first (the to-do's), and kept when another store view's page of the same to-do is picked */
  env?: Env; lockEnv?: boolean;
  current?: string; onPick: (p: Picked) => void; onClose?: () => void; title?: string;
  /** a new page may be made instead (the to-do's type offers it): the card at the top */
  onNew?: (n: NewAsked) => void;
  /** the AI is set up and the person may use it */
  ai?: boolean;
}) {
  const [q, setQ] = useState("");
  const [env, setEnv] = useState<Env>(envIn ?? "prod");
  const [onlyAcc, setOnlyAcc] = useState(false);
  const [store, setStore] = useState(storeIn ?? "de-CH");
  const [kind, setKind] = useState<"all" | PageKind>("all");
  const [found, setFound] = useState<Found | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreCount[]>([]);
  const [convert, setConvert] = useState<PageRow[]>([]);
  const [typed, setTyped] = useState("");
  const asked = useRef(0);
  const input = useRef<HTMLInputElement | null>(null);
  const listTop = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    input.current?.focus();
    void api.act<{ stores: StoreCount[] }>("stores").then((r) => {
      if (r.ok) setStores([...r.result.stores].sort((a, b) => storeRank(a.store) - storeRank(b.store)));
    });
    void api.act<{ rows: PageRow[] }>("convert").then((r) => { if (r.ok) setConvert(r.result.rows); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (n: number) => {
    const ask = ++asked.current;
    setBusy(true); setErr(null);
    const timeout = new Promise<{ ok: false; error: string }>((res) => setTimeout(() => res({ ok: false, error: "The hub took too long to answer." }), 20_000));
    const r = await Promise.race([api.act<Found>("pages", { q, env, only: env === "acc" && onlyAcc, store: store === "all" ? null : store, kind: kind === "all" ? null : kind, page: n }), timeout]);
    if (ask !== asked.current) return;
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    // one page of the list at a time (13.11.2026: numbered pages, no longer "Show more" adding to the end)
    setFound(r.result);
    setPage(n);
    if (n > 0) listTop.current?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, env, onlyAcc, store, kind]);

  useEffect(() => { const t = setTimeout(() => void load(0), q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const pick = (r: PageRow) => onPick({ env: r.env, path: r.path, store: r.store || null, kind: r.kind });
  const typedOk = typedPath(typed);
  // a path alone opens in the environment shown; a full address in its own (unless the to-do's is kept)
  const typedEnv = typedOk ? (lockEnv ? env : pickedEnv(typedOk.env, env)) : env;
  const useTyped = () => { if (!typedOk) return; const i = pathInfo(typedOk.path)!; onPick({ env: typedEnv, path: typedOk.path, store: i.store, kind: i.kind }); };
  const envStores = storesFor(env, stores, STORE_ORDER);
  const storeOpts = [...(lockStore ? [] : [{ key: "all", label: "Every store" }]), ...(lockStore ? [store] : envStores).map((s) => ({ key: s, label: s }))];
  const envOpts = ENV_OPTIONS.filter((o) => !lockEnv || o.key === env);
  // the list's pages: from the total (the server counts up to 5,000); a page that says there are more counts one further
  const pages = found ? pagesOf(found.total, page, found.more, PER_PAGE) : 0;
  const convertHere = convert.filter((r) => r.env === env && (store === "all" || r.store === store) && (!q || r.path.toLowerCase().includes(q.toLowerCase())));

  return (
    <Box sx={{ maxWidth: 980, mx: "auto", px: { xs: 1, md: 2 }, py: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.35rem", fontWeight: 750, color: INK, letterSpacing: "-0.015em" }}>{title ?? (onNew ? "A new page, or a page of the shop?" : "Which page of the shop?")}</Typography>
          <Typography sx={{ fontSize: "0.88rem", color: MUTED, mt: 0.25 }}>{onNew ? "Make a new page from a few words, or search the shop's pages below." : `Search by the words in its address or a product number. It opens here, as ${env === "acc" ? "ACC" : "the shop"} shows it, ready to edit.`}</Typography>
        </Box>
        {onClose && <Button onClick={onClose} startIcon={<CloseIcon />} sx={{ ...btn, color: INK }}>Close</Button>}
      </Box>

      {onNew && <NewPageCard store={store === "all" ? storeIn ?? "de-CH" : store} env={env} ai={!!ai} onNew={onNew} />}
      {onNew && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Or a page of the shop</Typography>}

      <TextField fullWidth inputRef={input} placeholder="o-ring, dichtungen, 12202510 …" value={q} onChange={(e) => setQ(e.target.value)} sx={{ ...field, mb: 1.5, "& .MuiInputBase-root": { fontSize: "1.02rem", height: 50, bgcolor: "#fff" } }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: MUTED }} /></InputAdornment>, endAdornment: busy ? <InputAdornment position="end"><CircularProgress size={16} /></InputAdornment> : undefined } }} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
        <Choice label="Environment" value={env} onChange={(e: Env) => { if (lockEnv) return; setEnv(e); setFound(null); }} options={envOpts} />
        {env === "acc" && !lockEnv && (
          <Choice label="Pages" value={onlyAcc ? "only" : "all"} onChange={(v: string) => setOnlyAcc(v === "only")} options={[{ key: "all", label: "Every ACC page" }, { key: "only", label: "Only on ACC" }]} />
        )}
        <Choice label="Store" value={store} onChange={setStore} options={storeOpts} />
        <Choice label="Kind" value={kind} onChange={setKind} options={KINDS} />
      </Box>

      {convertHere.length > 0 && !q && (
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>In AI testing & personalization</Typography>
          <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", overflow: "hidden" }}>
            {convertHere.slice(0, 6).map((r) => <Row key={`c${r.env}${r.path}`} r={r} onPick={pick} current={r.path === current} />)}
          </Box>
        </Box>
      )}

      <Box ref={listTop} sx={{ display: "flex", alignItems: "baseline", mb: 0.75, scrollMarginTop: 12 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, flex: 1 }}>
          {found ? `${found.total >= 5000 ? "5,000+" : found.total.toLocaleString("en-US")} page${found.total === 1 ? "" : "s"}` : "The shop's pages"}
        </Typography>
        {found && pages > 1 && <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{`${page * PER_PAGE + 1}-${page * PER_PAGE + found.rows.length} · page ${page + 1} of ${pages}`}</Typography>}
      </Box>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", overflow: "hidden", minHeight: 120 }}>
        {!found && busy && <Box sx={{ p: 3, color: MUTED, display: "flex", gap: 1.25, alignItems: "center", fontSize: "0.9rem" }}><CircularProgress size={16} /> Reading the shop&apos;s pages…</Box>}
        {err && (
          <Box sx={{ p: 2.5, display: "flex", gap: 1.5, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.9rem", color: "#c5221f", flex: 1 }}>{err}</Typography>
            <Button variant="outlined" onClick={() => void load(0)} sx={{ ...btn, borderRadius: "6px" }}>Try again</Button>
          </Box>
        )}
        {found && found.rows.length === 0 && !err && (
          <Typography sx={{ p: 2.5, fontSize: "0.9rem", color: MUTED }}>
            {q || kind !== "all" || onlyAcc ? "No page matches - fewer words, or another store." : `${env === "acc" ? "ACC's" : "The shop's"} pages are not indexed here yet (AI testing & personalization reads them once a day). Type the page's address below.`}
          </Typography>
        )}
        {found?.rows.map((r) => <Row key={`${r.env}${r.path}`} r={r} onPick={pick} current={r.path === current} />)}
        {found && <Pager page={page} pages={pages} busy={busy} onGo={(n) => void load(n)} />}
      </Box>

      <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "center" }}>
        <TextField fullWidth size="small" placeholder={`Or paste its address: ${ENV_HOST[env]}/de-CH/…`} value={typed} onChange={(e) => setTyped(e.target.value)} sx={{ ...field, "& .MuiInputBase-root": { bgcolor: "#fff" } }}
          onKeyDown={(e) => { if (e.key === "Enter") useTyped(); }} />
        <Button variant="contained" disableElevation disabled={!typedOk} onClick={useTyped} sx={{ ...btn, bgcolor: PINK, borderRadius: "6px", "&:hover": { bgcolor: "#a3245c" } }}>Open it</Button>
      </Box>
      {typed && !typedOk && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.75 }}>A page of the shop: its address or path, without the cart, account or search.</Typography>}
      {typedOk && typedOk.env && typedOk.env !== env && !lockEnv && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.75 }}>It opens from {ENV_LABEL[typedOk.env]}, as its address says.</Typography>}
      {typedOk && typedOk.env && typedOk.env !== env && lockEnv && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.75 }}>It opens from {ENV_LABEL[env]}: this to-do works there.</Typography>}
    </Box>
  );
}
