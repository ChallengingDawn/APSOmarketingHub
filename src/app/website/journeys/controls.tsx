"use client";

// Website > Journeys - the choices its pages share, KEPT IN THE ADDRESS (a view can be sent, and the next page opens on
// the same store view and device): the store view - every one of the shop's 14 (src/lib/journeys/model.ts STORE_VIEWS),
// each with its visits; one without visits is shown and cannot be picked, never hidden (SARCLA 09.11.2026: "not all
// store views are in Store view") - the device, and the search over the shop's pages (APSOconvert's page index, the
// most viewed pages of the period first).

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  DEVICES, DEVICE_NAME, KIND_COLOR, STORE_VIEWS, isDevice, isStoreView, journeyKind, pageName, pathKey,
  type Device, type StoreChoice,
} from "@/lib/journeys/model";

const BLUE = "#2459d1";

export type JQuery = { store: string | null; device: Device | null };

/** The address's choices, and a way to change them (replace: the same view; push: a move, kept in the history). */
export function useJQuery() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawStore = sp.get("store"), rawDevice = sp.get("device");
  const q: JQuery = { store: isStoreView(rawStore) ? rawStore : null, device: isDevice(rawDevice) ? rawDevice : null };
  const set = useCallback((patch: Record<string, string | string[] | null>, how: "replace" | "push" = "replace") => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (v === null) continue;
      for (const x of Array.isArray(v) ? v : [v]) next.append(k, x);
    }
    const s = next.toString();
    const href = `${pathname}${s ? `?${s}` : ""}`;
    if (how === "push") router.push(href, { scroll: true }); else router.replace(href, { scroll: false });
  }, [sp, router, pathname]);
  return { q, set, sp };
}

/** "store=de-CH&device=mobile" plus more - the query a link to another page of Journeys carries. */
export function jqs(q: JQuery, more: Record<string, string | string[] | null | undefined> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(more)) {
    if (v === null || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
  }
  if (q.store) p.set("store", q.store);
  if (q.device) p.set("device", q.device);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** A count for a small button: 840, 4.3k, 21k. */
export const short = (n: number) => (n < 1000 ? String(Math.round(n)) : n < 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(n / 1000)}k`);

const LANGUAGE: Record<string, string> = { de: "DE", fr: "FR", it: "IT", en: "EN", nl: "NL", pl: "PL" };

/**
 * The store view: all stores, then the shop's 14 by language, each with its visits in the period (an extra store view
 * with visits after them). Squared buttons on a wide screen, one list on a phone.
 */
export function StoreViewPicker({ value, onChange, stores }: { value: string | null; onChange: (s: string | null) => void; stores: StoreChoice[] | null }) {
  const list: StoreChoice[] = stores ?? STORE_VIEWS.map((key) => ({ key, sessions: -1, listed: true }));
  const total = stores ? stores.reduce((a, s) => a + s.sessions, 0) : null;
  const groups = useMemo(() => {
    const m = new Map<string, StoreChoice[]>();
    for (const s of list) {
      const g = s.listed ? (LANGUAGE[s.key.slice(0, 2)] ?? "Other") : "Other";
      m.set(g, [...(m.get(g) ?? []), s]);
    }
    return [...m];
  }, [list]);
  const off = (s: StoreChoice) => stores !== null && s.sessions <= 0 && s.key !== value;
  const btn = (key: string | null, label: string, n: number | null, disabled: boolean, first: boolean) => {
    const on = (value ?? null) === key;
    return (
      <Box key={key ?? "all"} component="button" type="button" role="radio" aria-checked={on} disabled={disabled}
        title={disabled ? `${label}: no visits in this period` : n !== null ? `${label}: ${full(n)} visits` : label}
        onClick={() => onChange(key)} sx={{
          all: "unset", cursor: disabled ? "default" : "pointer", px: 1.1, py: 0.5, fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.35,
          borderLeft: first ? "none" : `1px solid ${HAIRLINE}`, color: on ? "#fff" : disabled ? "#b3bccb" : INK, bgcolor: on ? BLUE : "transparent",
          whiteSpace: "nowrap", "&:hover": on || disabled ? {} : { bgcolor: "rgba(36,89,209,.07)", color: BLUE },
          "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
        }}>
        {label}
        {n !== null && <Box component="span" sx={{ ml: 0.6, fontWeight: 700, color: on ? "rgba(255,255,255,.85)" : disabled ? "#c6cdd8" : MUTED, fontVariantNumeric: "tabular-nums" }}>{n > 0 ? short(n) : "0"}</Box>}
      </Box>
    );
  };
  const seg = { display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.75)" } as const;
  return (
    <>
      <Box role="radiogroup" aria-label="Store view" sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1, rowGap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
        <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mr: 0.25 }}>Store view</Typography>
        <Box sx={seg}>{btn(null, "All stores", total, false, true)}</Box>
        {groups.map(([g, items]) => (
          <Box key={g} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT }}>{g}</Typography>
            <Box sx={seg}>{items.map((s, i) => btn(s.key, s.key, s.sessions >= 0 ? s.sessions : null, off(s), i === 0))}</Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <TextField select fullWidth size="small" label="Store view" value={value ?? "all"} onChange={(e) => onChange(e.target.value === "all" ? null : e.target.value)}
          SelectProps={{ native: true }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: "6px", bgcolor: "rgba(255,255,255,.8)", fontSize: "0.9rem" } }}>
          <option value="all">All stores{total !== null ? ` · ${full(total)} visits` : ""}</option>
          {list.map((s) => (
            <option key={s.key} value={s.key} disabled={off(s)}>
              {s.key}{s.sessions < 0 ? "" : s.sessions > 0 ? ` · ${full(s.sessions)} visits` : " · no visits"}
            </option>
          ))}
        </TextField>
      </Box>
    </>
  );
}

export function DevicePicker({ value, onChange }: { value: Device | null; onChange: (d: Device | null) => void }) {
  return (
    <SquareChoice<string> label="Device" value={value ?? "all"} onChange={(k) => onChange(isDevice(k) ? k : null)}
      options={[{ key: "all", label: "All devices" }, ...DEVICES.map((d) => ({ key: d, label: DEVICE_NAME[d] }))]} />
  );
}

/** The store view and the device, as one bar under the page's title. */
export function ChoiceBar({ q, set, stores, children }: {
  q: JQuery; set: (patch: Record<string, string | null>) => void; stores: StoreChoice[] | null; children?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "grid", gap: 1.25, minWidth: 0 }}>
      <StoreViewPicker value={q.store} stores={stores} onChange={(s) => set({ store: s })} />
      <Box sx={{ display: "flex", gap: 2, rowGap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
        <DevicePicker value={q.device} onChange={(d) => set({ device: d })} />
        {children}
      </Box>
    </Box>
  );
}

/* ── finding a page ───────────────────────────────────────────────────── */

export type PageHit = { path: string; name: string; note?: string };

/** What someone typed or pasted, as a path of the shop: the whole address or the path, without query or anchor. */
export function toPath(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const p = /^https?:\/\//i.test(s) ? new URL(s).pathname : s.split(/[?#]/)[0];
    const path = p.startsWith("/") ? p : `/${p}`;
    return path.length <= 300 && !/\s/.test(path) && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}

type IndexRow = { store: string; rest: string; prod: { url: string } | null; acc: { url: string } | null };

/**
 * A page of the shop: typed (a name, a product number, an address - pasted whole or not) over APSOconvert's page index,
 * the `suggest`ed ones first while nothing is typed. Enter on an address opens it as it is.
 */
export function PageSearch({ onPick, suggest, store, placeholder, autoFocus }: {
  onPick: (path: string) => void; suggest: PageHit[]; store: string | null; placeholder?: string; autoFocus?: boolean;
}) {
  const [input, setInput] = useState("");
  const [hits, setHits] = useState<PageHit[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2 || q.startsWith("/") || /^https?:/i.test(q)) { setHits([]); return; }
    const c = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      fetch(`/api/website/ai-personalization/pages?q=${encodeURIComponent(q)}${store ? `&store=${encodeURIComponent(store)}` : ""}`, { signal: c.signal })
        .then((r) => r.json())
        .then((j: { ok?: boolean; data?: { list?: { rows?: IndexRow[] } } }) => {
          const rows = j.data?.list?.rows ?? [];
          setHits(rows.slice(0, 20).map((r) => {
            let path = `/${r.store}/${r.rest}`;
            try { path = new URL((r.prod ?? r.acc)!.url).pathname; } catch { /* the index's own parts */ }
            return { path, name: pageName(path), note: r.prod ? undefined : "on ACC only" };
          }));
        })
        .catch(() => { /* a newer search, or the index is not there */ })
        .finally(() => setBusy(false));
    }, 250);
    return () => { clearTimeout(t); c.abort(); };
  }, [input, store]);
  const typed = toPath(input);
  const options: PageHit[] = input.trim().length < 2 ? suggest : [
    ...(typed && (input.trim().startsWith("/") || /^https?:/i.test(input.trim())) ? [{ path: typed, name: pageName(typed), note: "this address" }] : []),
    ...hits,
    ...suggest.filter((s) => s.name.toLowerCase().includes(input.trim().toLowerCase()) && !hits.some((h) => pathKey(h.path) === pathKey(s.path))),
  ];
  return (
    <Autocomplete<PageHit, false, false, true>
      freeSolo fullWidth options={options} loading={busy} filterOptions={(x) => x} inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
      isOptionEqualToValue={(a, b) => a.path === b.path}
      onChange={(_, v) => {
        if (!v) return;
        // Enter on words: the first page found; on an address: that address
        const typedAddress = typeof v === "string" && (v.trim().startsWith("/") || /^https?:/i.test(v.trim()));
        const path = typeof v !== "string" ? v.path : typedAddress ? toPath(v) : options.find((o) => o.note !== "this address")?.path ?? null;
        if (path) { onPick(path); setInput(""); }
      }}
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={`${key}:${o.path}`} {...rest} sx={{ display: "flex", gap: 1.25, alignItems: "center", py: "8px !important" }}>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: KIND_COLOR[journeyKind(o.path)], flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, overflowWrap: "anywhere" }}>{o.name}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, overflowWrap: "anywhere" }}>{o.path}</Typography>
            </Box>
            {o.note && <Typography sx={{ fontSize: "0.74rem", color: FAINT, whiteSpace: "nowrap" }}>{o.note}</Typography>}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} autoFocus={autoFocus} placeholder={placeholder ?? "Find a page: a name, a product number, or paste its address"}
          InputProps={{ ...params.InputProps, startAdornment: <SearchOutlinedIcon sx={{ color: MUTED, fontSize: 20, ml: 0.5, mr: 0.25 }} /> }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "6px", bgcolor: "rgba(255,255,255,.9)", fontSize: "0.92rem" } }} />
      )}
    />
  );
}
