"use client";

// DATATRACKER — the desktop E-Shop Data Tracker's customer table, live.
//
// The desktop tracker has to be exported by hand; these figures reach HubSpot
// every night, so this is the same question answered without the export. Logins
// and views are counted by the shop on an essential-cookie basis, which is why
// they cover every customer and GA4's numbers do not.

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tabs from "@mui/material/Tabs";
import Link from "@mui/material/Link";
import Tab from "@mui/material/Tab";
import { GUTTER, HAIRLINE, INK, MUTED } from "@/app/analytics/Shell";
import PageHeader from "@/app/PageHeader";
// The use-case report look, as on Erosion: frosted cards, tinted icon badges.
import { FAINT, GlassCard, KpiTile, glass } from "@/app/uc/report/ui";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EuroIcon from "@mui/icons-material/Euro";
import { compact, decimal, full } from "@/app/charts/format";
import { ESHOP_YEARS, type ActivityLine, type EshopActivity, type EshopYear } from "@/lib/integrations/eshopActivity";
import { companyPasses, isoDay, periodWindow, shortPriority } from "@/lib/datatracker/rules";

import type { ArticleActivity, ArticleRow } from "@/lib/integrations/articleActivity";
import type { LookRecord, ShopSignals } from "@/lib/integrations/shopSignals";
import type { Alternative } from "@/app/api/datatracker/alternatives/route";
import type { ContactCard } from "@/app/api/datatracker/contacts/route";

/** What the alternatives route hands back for one article. */
type AltPayload = { subGroup: string | null; group?: string | null; rows: Alternative[];
  wantedSize?: number | null; considered?: number };

/** Every column on the Articles tab is sortable; these are its keys. */
type ArticleSortKey =
  | "articleNumber" | "description" | "mainGroup" | "articleType"
  | "views" | "lookedBy" | "carts" | "topQty" | "lastLooked"
  | "orders" | "companies" | "stock";

type OrdersPayload = {
  from: string; to: string;
  byCompany: Record<string, { orders: number; value: number }>;
  companies: Record<string, { name: string | null; customerNumber: string | null; mandant: string | null;
    country: string | null; apsoCustomer: string | null; salesPriority: string | null; representative: string | null }>;
  scanned: number; capped: boolean; unattributed: number; detailTruncated: number; offChannel: number;
  detailsComplete?: boolean;
  /** Echoed back so the follow-up call reuses this scan instead of repeating it. */
  scanId?: string;
};

type Options = { countries: string[]; mandants: string[]; apsoCustomers: string[]; priorities: string[]; representatives: { id: string; name: string }[] };

/** Six years of views in one cell. Bars, not a line: the values are counts. */
/** One line, ellipsis when it will not fit. Used by every table on the page. */
/** A ticket in the portal. Tickets are object type 0-5. */
const hsTicketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;

const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const };
/** Column headers as on the UC reports: small, upper case, faint - the figures carry the weight. */
const HEAD = { fontWeight: 600, color: FAINT, fontSize: "0.68rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" };

function YearBars({ history, year }: { history: { year: number; views: number | null }[]; year: number }) {
  const top = Math.max(1, ...history.map((h) => h.views ?? 0));
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.4, height: 22 }}>
      {history.map((h) => (
        <Tooltip key={h.year} title={`${h.year}: ${full(h.views)} views`} describeChild>
          <Box
            sx={{
              width: 7,
              height: `${Math.max(2, ((h.views ?? 0) / top) * 22)}px`,
              borderRadius: 0.4,
              bgcolor: h.year === year ? "#2d6fa8" : "#c7ccd4",
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

/** Ranges the live counters can answer. The year picker still drives history. */
// Labels only. How far back each reaches lives in RANGE_DAYS in the rules
// module, so the window cannot drift from the one that is tested.
const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "This quarter" },
  { id: "365d", label: "Last 12 months" },
] as const;

/** Portal 26492587 on the EU cluster; 0-2 = companies. Same as /customers. */
const HS_PORTAL = "26492587";
const hsCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-2/${id}`;
/** 0-1 = contacts. */
const hsContactUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${HS_PORTAL}/record/0-1/${id}`;

// What the SERVER sorts by, which decides which rows arrive first when there
// are more than a page of them. Order value is not a HubSpot-sortable field, so
// it is not offered here - the column headers sort what has been loaded.
const SORTS = [
  { id: "views", label: "Most views" },
  { id: "logins", label: "Most logins" },
  { id: "revenue", label: "Most revenue" },
] as const;

type SortKey =
  | "mandant" | "customerNumber" | "name" | "country" | "representative" | "apsoCustomer" | "salesPriority"
  | "logins" | "views" | "orders" | "orderValue" | "viewsPerLogin" | "revenueYtd";

type OrderLine = { article: string; description: string | null; qty: number | null; revenue: number | null; orders: number; eshop?: boolean };
type OrderedPayload = { lines: OrderLine[]; articles: string[] };
type OrderedState = OrderedPayload | "loading" | "error" | undefined;

/**
 * What one customer did with an article: looked at it, put it in the cart,
 * bought it. Two sources, merged on the article number.
 *
 * The browser feed alone is not enough and cannot be made enough. The article
 * is the TEN-digit variant, chosen on the page - every product page shares one
 * URL across its 32 thicknesses - and the order is placed from the cart. So
 * Metrohm AG can place the largest order of the day against one login and zero
 * views. The order lines know the article, the quantity and the value, and
 * they also cover an order placed by phone.
 */
function RecentLines({ lines, ordered }: { lines: ActivityLine[]; ordered: OrderedState }) {
  // Names for everything on this panel, articles and product pages alike. One
  // call when the row opens; a failure costs the names and nothing else.
  const [names, setNames] = useState<Record<string, string>>({});
  const wantNames = lines.map((l) => l.article || l.product || "").filter(Boolean).join(",");
  useEffect(() => {
    if (!wantNames) return;
    const ids = wantNames.split(",");
    const q = new URLSearchParams({
      articles: ids.filter((i) => /^\d{10}$/.test(i)).join(","),
      products: ids.filter((i) => /^\d{8}$/.test(i)).join(","),
    });
    let alive = true;
    fetch(`/api/datatracker/describe?${q}`)
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.data) setNames(j.data as Record<string, string>); })
      .catch(() => {});
    return () => { alive = false; };
  }, [wantNames]);

  // Who was logged in: the gateway writes the HubSpot contact id on each line
  // (`u`), so the row can name the person, not only the company. One batch read
  // when the row opens; lines from before October carry no id and show "—".
  const [people, setPeople] = useState<Record<string, ContactCard>>({});
  const wantPeople = [...new Set(lines.map((l) => l.contact).filter((c): c is string => !!c))].join(",");
  useEffect(() => {
    if (!wantPeople) return;
    let alive = true;
    fetch(`/api/datatracker/contacts?ids=${wantPeople}`)
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.data) setPeople(j.data as Record<string, ContactCard>); })
      .catch(() => {});
    return () => { alive = false; };
  }, [wantPeople]);
  const personLabel = (id: string | null) => (id ? people[id]?.email ?? people[id]?.name ?? `contact ${id}` : null);

  const payload = ordered && ordered !== "loading" && ordered !== "error" ? ordered : null;
  const byArticle = new Map((payload?.lines ?? []).map((l) => [l.article, l]));
  const everBought = new Set(payload?.articles ?? []);

  type Row = { key: string; article: string | null; product: string | null; lookedAt: string | null; qtyTyped: number | null; cart: boolean; reported: boolean; contact: string | null };
  const rows: Row[] = [];
  const seen = new Set<string>();
  // Once the quantity lookup has named the article, the bare product-page line
  // for the same product says strictly less about the same visit. Drop it
  // rather than show the customer twice.
  const namedProducts = new Set(lines.filter((v) => v.article && v.product).map((v) => v.product as string));
  for (const v of [...lines].reverse()) {
    if (!v.article && v.product && namedProducts.has(v.product)) continue;
    const key = v.article ?? `p:${v.product}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, article: v.article, product: v.product, lookedAt: v.t, qtyTyped: v.qty, cart: v.cart, reported: v.ordered, contact: v.contact });
  }
  // Ordered in this window but never seen being looked at - the Metrohm case.
  for (const l of payload?.lines ?? []) {
    if (seen.has(l.article)) continue;
    seen.add(l.article);
    rows.push({ key: l.article, article: l.article, product: null, lookedAt: null, qtyTyped: null, cart: false, reported: false, contact: null });
  }
  rows.sort((a, b) => {
    const va = byArticle.get(a.article ?? "")?.revenue ?? 0;
    const vb = byArticle.get(b.article ?? "")?.revenue ?? 0;
    if (va !== vb) return vb - va;
    return (b.lookedAt ?? "").localeCompare(a.lookedAt ?? "");
  });

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
        {ordered === "loading"
          ? "Reading this customer's orders…"
          : "Nothing looked at and nothing ordered in this period."}
      </Typography>
    );
  }

  const z = { "&:nth-of-type(odd)": { bgcolor: "#f4f7fb" } };   // zebra, so a long list stays readable
  const c = { borderColor: HAIRLINE, fontSize: "0.78rem", py: 0.75 };
  const h = { ...c, fontWeight: 700, color: MUTED, fontSize: "0.67rem",
    textTransform: "uppercase" as const, letterSpacing: 0.4, whiteSpace: "nowrap" as const };

  // Everyone who was logged in for these lines, most recent first.
  const loggedIn = [...new Set([...lines].reverse().map((l) => l.contact).filter((c): c is string => !!c))];

  return (
    <>
    {loggedIn.length > 0 && (
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
        Logged in as{" "}
        {loggedIn.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && " · "}
            <Link href={hsContactUrl(id)} target="_blank" rel="noopener" underline="hover" sx={{ color: INK, fontWeight: 600 }}
              title={people[id]?.name ?? undefined}>
              {personLabel(id)}
            </Link>
          </Fragment>
        ))}
      </Typography>
    )}
    <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ ...h, width: 120 }}>Looked at</TableCell>
          <TableCell sx={{ ...h, width: 110 }}>Article</TableCell>
          <TableCell sx={h}>Description</TableCell>
          <TableCell sx={{ ...h, width: 210 }}>Contact</TableCell>
          <TableCell align="right" sx={{ ...h, width: 76 }}>Qty</TableCell>
          <TableCell align="center" sx={{ ...h, width: 70 }}>In cart</TableCell>
          <TableCell align="center" sx={{ ...h, width: 78 }}>Ordered</TableCell>
          <TableCell align="right" sx={{ ...h, width: 88 }}>Value</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => {
          const o = r.article ? byArticle.get(r.article) : undefined;
          const named = names[r.article ?? r.product ?? ""] ?? null;
          const boughtNow = !!o || r.reported;
          const inCart = r.cart || !!o?.eshop;
          const boughtEver = !boughtNow && !!r.article && everBought.has(r.article);
          const qty = o?.qty ?? r.qtyTyped;
          return (
            <TableRow key={r.key} sx={z}>
              <TableCell sx={{ ...c, color: MUTED, whiteSpace: "nowrap" }}>
                {r.lookedAt ? r.lookedAt.replace("T", " ") : "—"}
              </TableCell>
              <TableCell sx={{ ...c, color: r.article ? INK : MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>
                {r.article ?? r.product}
              </TableCell>
              <TableCell sx={{ ...c, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {/* The order line names it when they bought it; otherwise the
                    name is fetched, because the shop records what was looked at
                    and not what it is called. A bare number tells nobody
                    anything. */}
                {o?.description ?? named ?? (r.article ? "no catalogue record" : "product page, no size chosen")}
              </TableCell>
              <TableCell sx={{ ...c, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.contact ? people[r.contact]?.name ?? "" : ""}>
                {r.contact
                  ? <Link href={hsContactUrl(r.contact)} target="_blank" rel="noopener" underline="hover" sx={{ color: INK }}>{personLabel(r.contact)}</Link>
                  : <Box component="span" sx={{ color: MUTED }}>—</Box>}
              </TableCell>
              <TableCell align="right" sx={{ ...c, color: qty == null ? MUTED : INK, fontWeight: qty == null ? 400 : 600 }}>
                {qty == null ? "—" : decimal(qty, 0)}
              </TableCell>
              <TableCell align="center" sx={{ ...c, color: inCart ? INK : MUTED, fontWeight: inCart ? 600 : 400 }}>
                {inCart ? "Yes" : "—"}
              </TableCell>
              <TableCell align="center" sx={{ ...c, color: boughtNow ? INK : MUTED, fontWeight: boughtNow ? 700 : 400, whiteSpace: "nowrap" }}>
                {boughtNow ? "Yes" : boughtEver ? "Before" : ordered === "loading" ? "…" : "—"}
              </TableCell>
              <TableCell align="right" sx={{ ...c, color: o?.revenue ? INK : MUTED, fontWeight: o?.revenue ? 600 : 400, whiteSpace: "nowrap" }}>
                {o?.revenue ? `€${compact(o.revenue)}` : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </>
  );
}

/**
 * The MOQ and Availability screens are the same table with a different reason
 * attached, so they are one component. Neither raises a ticket - they are a
 * record of a sale that did not happen and of why, which is the thing nobody
 * had written down anywhere.
 */
function LookTable({ rows, kind, mandantOf }: {
  rows: LookRecord[];
  kind: "moq" | "availability";
  mandantOf: (r: LookRecord) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [alts, setAlts] = useState<Record<string, AltPayload | "loading">>({});

  const openRow = async (r: LookRecord) => {
    const id = `${r.companyId}|${r.day}|${r.article}`;
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (alts[id]) return;
    setAlts((a) => ({ ...a, [id]: "loading" }));
    const q = new URLSearchParams({ article: r.article, mandant: mandantOf(r) });
    if (r.qty != null) q.set("need", String(r.qty));
    try {
      const j = await fetch(`/api/datatracker/alternatives?${q}`).then((x) => x.json());
      setAlts((a) => ({ ...a, [id]: j?.ok && j.data ? (j.data as AltPayload) : { subGroup: null, rows: [] } }));
    } catch {
      setAlts((a) => ({ ...a, [id]: { subGroup: null, rows: [] } }));
    }
  };

  const c = { borderColor: HAIRLINE, fontSize: "0.78rem" };
  const h = { ...c, ...HEAD, whiteSpace: "nowrap" as const };

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ "& td, & th": { ...c, px: 1 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...h, width: 98 }}>Day</TableCell>
            <TableCell sx={h}>Customer</TableCell>
            <TableCell sx={{ ...h, width: 110 }}>Article</TableCell>
            <TableCell sx={h}>Description</TableCell>
            <TableCell align="right" sx={{ ...h, width: 86 }}>Wanted</TableCell>
            <TableCell align="right" sx={{ ...h, width: 100 }}>
              {kind === "moq" ? "Minimum" : "On the shelf"}
            </TableCell>
            <TableCell align="right" sx={{ ...h, width: 96 }}>Value</TableCell>
            <TableCell sx={{ ...h, width: 150 }}>Why it stalled</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const id = `${r.companyId}|${r.day}|${r.article}`;
            const alt = alts[id];
            return [
              <TableRow key={id} hover sx={{ cursor: "pointer" }} onClick={() => openRow(r)}>
                <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.day}</TableCell>
                <TableCell sx={{ color: INK, fontWeight: 600, ...clip }} title={r.companyName ?? ""}>
                  <Link href={hsCompanyUrl(r.companyId)} target="_blank" rel="noopener"
                    onClick={(e) => e.stopPropagation()} underline="hover" sx={{ color: INK, fontWeight: 600 }}>
                    {r.companyName ?? "—"}
                  </Link>
                </TableCell>
                <TableCell sx={{ color: INK, fontWeight: 600, whiteSpace: "nowrap" }}>{r.article}</TableCell>
                <TableCell sx={{ color: MUTED, ...clip }} title={r.description ?? ""}>{r.description ?? "—"}</TableCell>
                <TableCell align="right" sx={{ color: INK, whiteSpace: "nowrap" }}>
                  {r.qty == null ? "—" : `${full(r.qty)}${r.salesUnit ? ` ${r.salesUnit}` : ""}`}
                </TableCell>
                <TableCell align="right" sx={{ color: INK, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {kind === "moq"
                    ? (r.moqMinimum == null ? "yes, unknown" : full(r.moqMinimum))
                    : (r.stock == null ? "—" : `${full(r.stock)}${r.stockUnit ? ` ${r.stockUnit}` : ""}`)}
                </TableCell>
                <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                  {r.value == null ? "—" : `€${compact(r.value)}`}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography component="span" sx={{
                    fontSize: "0.72rem", fontWeight: 700, px: 0.9, py: 0.3, borderRadius: 1,
                    bgcolor: kind === "moq"
                      ? (r.belowMoq ? "#fdf0e6" : "#eef1f5")
                      : (r.stock === 0 ? "#fdecea" : "#fdf0e6"),
                    color: kind === "moq"
                      ? (r.belowMoq ? "#b26a00" : MUTED)
                      : (r.stock === 0 ? "#9e1b18" : "#b26a00"),
                  }}>
                    {kind === "moq"
                      ? (r.belowMoq ? "Asked below the minimum" : r.carted ? "In cart, not ordered" : "Has a minimum")
                      : (r.stock === 0 ? "Nothing on the shelf" : `${full(r.shortfall)} short`)}
                  </Typography>
                </TableCell>
              </TableRow>,
              open === id && (
                <TableRow key={`${id}-alt`}>
                  <TableCell colSpan={8} sx={{ p: 0, bgcolor: "#f7f9fc" }}>
                    <Box sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: MUTED, mb: 1 }}>
                        What we could have offered instead
                      </Typography>
                      {/* Say what the list matched on, or eight rows of the same
                          product family read as a guess. */}
                      {alt && alt !== "loading" && alt.rows.length > 0 && alt.wantedSize != null && (
                        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1 }}>
                          Nearest sizes to Ø {alt.wantedSize}, from {full(alt.considered ?? null)} in the same
                          sub-group that are on the shelf. Anything more than a quarter away is left out.
                        </Typography>
                      )}
                      {alt === "loading" && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>Looking…</Typography>}
                      {alt && alt !== "loading" && alt.rows.length === 0 && (
                        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
                          {alt.subGroup == null
                            ? "This article has no Products & Pricing record, so it has no neighbours to search."
                            : alt.considered
                              ? `${alt.considered} articles in the same sub-group are on the shelf, but none within a quarter of this size.`
                              : "Nothing in the same sub-group is on the shelf either."}
                        </Typography>
                      )}
                      {alt && alt !== "loading" && alt.rows.length > 0 && (
                        <Table size="small" sx={{ "& td, & th": { ...c, px: 1 },
                          "& tbody tr:nth-of-type(odd)": { bgcolor: "#eef3f9" } }}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ ...h, width: 110 }}>Article</TableCell>
                              <TableCell sx={h}>Description</TableCell>
                              <TableCell align="right" sx={{ ...h, width: 70 }}>Size</TableCell>
                              <TableCell align="right" sx={{ ...h, width: 120 }}>In stock</TableCell>
                              <TableCell sx={{ ...h, width: 124 }}>Minimum</TableCell>
                              <TableCell align="right" sx={{ ...h, width: 94 }}>Price</TableCell>
                              <TableCell sx={{ ...h, width: 118 }} />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {alt.rows.map((a) => (
                              <TableRow key={a.article}>
                                <TableCell sx={{ color: INK, fontWeight: 600, whiteSpace: "nowrap" }}>{a.article}</TableCell>
                                <TableCell sx={{ color: MUTED, ...clip }} title={a.description ?? ""}>{a.description ?? "—"}</TableCell>
                                <TableCell align="right" sx={{ color: a.sameColour ? INK : MUTED, whiteSpace: "nowrap" }}>
                                  {a.size == null ? "—" : `Ø ${a.size}`}
                                </TableCell>
                                <TableCell align="right" sx={{ color: INK, whiteSpace: "nowrap" }}>
                                  {a.stock == null ? "—" : `${full(a.stock)}${a.stockUnit ? ` ${a.stockUnit}` : ""}`}
                                </TableCell>
                                <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                                  {a.moq == null ? "unknown" : /^y/i.test(a.moq) ? `${a.moqMinimum ?? "?"}` : "none"}
                                </TableCell>
                                <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                                  {a.price == null ? "—" : `€${decimal(a.price, 2)}`}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: "nowrap" }}>
                                  {/* The whole point of the list: which of these
                                      would actually have served the order. */}
                                  {a.covers && (
                                    <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700,
                                      px: 0.9, py: 0.3, borderRadius: 1, bgcolor: "#e6f4ec", color: "#0f7b4f" }}>
                                      Would have covered it
                                    </Typography>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ),
            ];
          })}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={8} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
              Nothing to record in this window.
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

type TabId = "customers" | "articles" | "priceCheck" | "moq" | "availability";
/** The address of each tab, as the sidebar links to it (?tab=<slug>). */
const SLUG_OF_TAB: Record<TabId, string> = {
  customers: "customers", articles: "articles", priceCheck: "price-checks", moq: "moq", availability: "availability",
};
const TAB_OF_SLUG: Record<string, TabId> = Object.fromEntries(
  Object.entries(SLUG_OF_TAB).map(([t, s]) => [s, t as TabId]),
);

/** useSearchParams needs a Suspense boundary, or the page leaves static rendering. */
export default function DatatrackerPage() {
  return (
    <Suspense fallback={null}>
      <EshopActivityPage />
    </Suspense>
  );
}

function EshopActivityPage() {
  const [data, setData] = useState<EshopActivity | null>(null);
  const [extraRows, setExtraRows] = useState<EshopActivity["rows"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [orderedBy, setOrderedBy] = useState<Record<string, Exclude<OrderedState, undefined>>>({});
  const [orders, setOrders] = useState<OrdersPayload | null>(null);
  const [minValue, setMinValue] = useState("");
  const [ordersError, setOrdersError] = useState<string | null>(null);
  // The money is the point of the screen, so it opens on it.
  const [sortKey, setSortKey] = useState<SortKey>("orderValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const askedOrders = useRef<Set<string>>(new Set());
  const [lastQuery, setLastQuery] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState("");
  const [mandant, setMandant] = useState("");
  const [apsoCustomer, setApsoCustomer] = useState("");
  const [representative, setRepresentative] = useState("");
  const [priority, setPriority] = useState("");
  const [period, setPeriod] = useState<string>("today");  // a RANGES id, "custom", or "y2026"
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 6 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("views");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"customers" | "articles" | "priceCheck" | "moq" | "availability">("customers");

  // Each tab has its own address - /datatracker?tab=moq - so the sidebar can list
  // the tabs, open one and show which is open. A click here changes the address
  // with history.replaceState, which Next keeps in step with the sidebar, and the
  // page is not reloaded, so the period and the filters stay as they are. The
  // old #hash links (#price-checks, #articles ...) still land on their tab.
  const urlTab = useSearchParams().get("tab");
  useEffect(() => {
    const fromHash = TAB_OF_SLUG[window.location.hash.replace("#", "")];
    setTab(TAB_OF_SLUG[urlTab ?? ""] ?? fromHash ?? "customers");
  }, [urlTab]);
  // A #hash link followed while the page is already open changes only the hash.
  useEffect(() => {
    const onHash = () => {
      const t = TAB_OF_SLUG[window.location.hash.replace("#", "")];
      if (t) setTab(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const selectTab = (t: typeof tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "customers" ? "/datatracker" : `/datatracker?tab=${SLUG_OF_TAB[t]}`);
  };
  const [articles, setArticles] = useState<ArticleActivity | null>(null);
  const [articleSort, setArticleSort] = useState<"orders" | "companies" | "stock">("orders");
  const [articlesError, setArticlesError] = useState<string | null>(null);
  // Which 200 HubSpot sends is `articleSort`; how the loaded rows are ordered on
  // screen is this. Clicking a header that HubSpot can sort on moves BOTH, so
  // the top of the table is the real top and not just the top of this page.
  const [articleSortKey, setArticleSortKey] = useState<ArticleSortKey>("orders");
  const [articleSortDir, setArticleSortDir] = useState<"asc" | "desc">("desc");
  const [articlePage, setArticlePage] = useState(0);
  const [articlePerPage, setArticlePerPage] = useState(25);
  const [articlesLoadingMore, setArticlesLoadingMore] = useState(false);
  // One read behind three tabs: price checks, MOQ and availability all come
  // out of the same shop lines, so asking three times would be three waits for
  // the same answer.
  const [signals, setSignals] = useState<ShopSignals | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [pcOnlyQualifying, setPcOnlyQualifying] = useState(true);
  const [pcOpen, setPcOpen] = useState<string | null>(null);
  // Preview / Create tickets live in the UC app (/uc/price-checks) only - this
  // screen records, it does not raise tickets.

  // One definition of the window, shared by the activity read and the orders
  // read, so the two halves of a row can never describe different days.
  // One definition of the window, shared by the activity read and the orders
  // read, and TESTED in tests/datatracker-rules.test.ts - a year reaching the
  // orders window only 30 days back is exactly the bug that hid in here.
  const { from: periodFrom, to: periodTo } = periodWindow(period, customFrom, customTo);

  const asYear = period.startsWith("y") ? (Number(period.slice(1)) as EshopYear) : null;
  const live = asYear === null;
  const year: EshopYear = asYear ?? 2026;

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ year: String(asYear ?? 2026), sort, limit: "200" });
    if (country) q.set("country", country);
    if (mandant) q.set("mandant", mandant);
    if (apsoCustomer) q.set("apsoCustomer", apsoCustomer);
    if (representative) q.set("representative", representative);
    if (priority) q.set("priority", priority);
    q.set("from", periodFrom);
    q.set("to", periodTo);
    q.set("mode", live ? "range" : "year");
    setData(null);
    setExtraRows([]);
    setPage(0);
    setCursor(null);
    setError(null);
    setLastQuery(q.toString());
    fetch(`/api/datatracker?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) { setData(j.data as EshopActivity); setCursor((j.data as EshopActivity).after ?? null); setOptions(j.options ?? null); }
        else setError(j?.error ?? j?.detail ?? "HubSpot did not answer.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setError(String(e)); });
    return () => ctrl.abort();
  }, [period, country, mandant, apsoCustomer, representative, priority, sort, customFrom, customTo, periodFrom, periodTo]);

  // Orders are the other half of the desktop tracker's table, and they are the
  // reason a customer who ordered without browsing still belongs on this list.
  useEffect(() => {
    if (tab !== "customers") return;
    const ctrl = new AbortController();
    setOrders(null);
    setOrdersError(null);
    const url = `/api/datatracker/orders?from=${periodFrom}&to=${periodTo}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) {
          setOrdersError([j?.step ? `${j.step}:` : "", j?.error ?? j?.detail ?? "HubSpot did not answer for orders.",
            j?.status ? `(HTTP ${j.status})` : ""].filter(Boolean).join(" "));
          return;
        }
        setOrders(j as OrdersPayload);
        // The totals are already complete; only the NAMES of the smaller
        // customers are still missing, so fetch them without blocking the table.
        if (j.detailsComplete === false) {
          const again = `${url}&detail=all${j.scanId ? `&scan=${encodeURIComponent(j.scanId)}` : ""}`;
          fetch(again, { signal: ctrl.signal })
            .then((r) => r.json())
            .then((full) => { if (full?.ok) setOrders(full as OrdersPayload); })
            .catch(() => {});
        }
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setOrdersError(String(e)); });
    return () => ctrl.abort();
  }, [tab, periodFrom, periodTo]);

  // The article scan reads every company carrying activity, so it cannot run
  // once per keystroke. The customers table filters the rows it already has;
  // this one waits for a pause in the typing.
  const [searchSlow, setSearchSlow] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchSlow(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // The same window as the rest of the screen, so a price check and the order
  // that may have followed it are never read over different days.
  useEffect(() => {
    if (tab !== "priceCheck" && tab !== "moq" && tab !== "availability") return;
    const ctrl = new AbortController();
    setSignals(null);
    setSignalsError(null);
    fetch(`/api/datatracker/signals?from=${periodFrom}&to=${periodTo}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) setSignals(j.data as ShopSignals);
        else setSignalsError(j?.error ?? j?.detail ?? "HubSpot did not answer for the shop signals.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setSignalsError(String(e)); });
    return () => ctrl.abort();
  }, [tab, periodFrom, periodTo]);

  useEffect(() => {
    if (tab !== "articles") return;
    const ctrl = new AbortController();
    setArticles(null);
    setArticlesError(null);
    setArticlePage(0);
    const q = new URLSearchParams({ sort: articleSort, limit: "200" });
    if (searchSlow.trim()) q.set("search", searchSlow.trim());
    fetch(`/api/datatracker/articles?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.data) setArticles(j.data);
        else setArticlesError(j?.error ?? j?.detail ?? "HubSpot did not answer for articles.");
      })
      .catch((e) => { if ((e as Error)?.name !== "AbortError") setArticlesError(String(e)); });
    return () => ctrl.abort();
  }, [tab, articleSort, searchSlow]);

  // Typing filters what is on screen rather than asking HubSpot again: the rows
  // are already here, and a search per keystroke would hit the search throttle.
  // ---- the Articles tab, sorted and paged over what has been loaded ---------
  const articleRows = (() => {
    const rows = [...(articles?.rows ?? [])];
    const pick = (a: ArticleRow): string | number | null => {
      switch (articleSortKey) {
        case "articleNumber": return a.articleNumber ?? "";
        case "description": return a.description ?? "";
        case "mainGroup": return a.mainGroup ?? "";
        case "articleType": return a.articleType ?? "";
        case "lastLooked": return a.lastLooked ?? "";
        default: return (a[articleSortKey] as number | null) ?? null;
      }
    };
    return rows.sort((x, y) => {
      const a = pick(x), b = pick(y);
      // A dash is "never looked at", not zero, so it sorts to the bottom either
      // way rather than claiming the top of an ascending sort.
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      const cmp = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true });
      return articleSortDir === "desc" ? -cmp : cmp;
    });
  })();
  const articlePageRows = articleRows.slice(articlePage * articlePerPage, articlePage * articlePerPage + articlePerPage);

  const onArticleSort = (k: ArticleSortKey) => {
    if (k === articleSortKey) { setArticleSortDir((d) => (d === "desc" ? "asc" : "desc")); setArticlePage(0); return; }
    setArticleSortKey(k);
    setArticleSortDir(k === "articleNumber" || k === "description" || k === "mainGroup" || k === "articleType" ? "asc" : "desc");
    setArticlePage(0);
    // These three decide WHICH articles HubSpot sends, so clicking them has to
    // refetch; the rest only reorder what is already on screen.
    if (k === "orders" || k === "companies" || k === "stock") setArticleSort(k);
  };

  const loadMoreArticles = useCallback(async () => {
    if (!articles?.after || articlesLoadingMore) return;
    setArticlesLoadingMore(true);
    try {
      const q = new URLSearchParams({ sort: articleSort, limit: "200", after: articles.after });
      if (searchSlow.trim()) q.set("search", searchSlow.trim());
      const j = await fetch(`/api/datatracker/articles?${q}`).then((r) => r.json());
      if (j?.ok && j.data) {
        const next = j.data as ArticleActivity;
        setArticles((cur) => (cur ? { ...next, rows: [...cur.rows, ...next.rows] } : next));
      }
    } finally {
      setArticlesLoadingMore(false);
    }
  }, [articles, articlesLoadingMore, articleSort, searchSlow]);

  // A row that does not qualify is still worth seeing: it is how you check the
  // rule is drawing its line where you meant it to.
  // The filters bite on every customer-level view, not only Customers: a price
  // check, a MOQ look and an availability look each belong to one company, so
  // mandant, country, priority, the search and the value floor apply to them too.
  // Selection and representative only where the row carries them (price checks).
  const floor = Number(minValue.replace(",", ".")) || 0;
  const needle = searchSlow.trim().toLowerCase();
  const textHit = (...vals: (string | null | undefined)[]) => !needle || vals.some((v) => (v ?? "").toLowerCase().includes(needle));
  const pcRows = (signals?.priceChecks ?? []).filter((r) =>
    companyPasses(r, { mandant, country, apsoCustomer, priority, representative })
    && textHit(r.companyName, r.customerNumber, ...r.articles.map((a) => a.article))
    && (!floor || r.value >= floor));
  const lookPasses = (r: LookRecord) =>
    (!mandant || r.mandant === mandant) && (!country || r.country === country) && (!priority || r.salesPriority === priority)
    && textHit(r.companyName, r.customerNumber, r.article, r.description) && (!floor || (r.value ?? 0) >= floor);
  const moqRows = (signals?.moq ?? []).filter(lookPasses);
  const availabilityRows = (signals?.availability ?? []).filter(lookPasses);
  const qualifying = pcRows.filter((r) => r.qualifies && !r.excluded);
  const pcVisible = pcOnlyQualifying ? qualifying : pcRows;

  // Which filters a tab shows. Articles are totals over every customer, so only
  // the search reaches them (plus their own sort); the "Most views" sort is the
  // customer list's own.
  const usedHere = {
    period: tab !== "articles",
    company: tab !== "articles",
    selection: tab === "customers" || tab === "priceCheck",
    sort: tab === "customers",
  };
  // SARCLA: a filter a view cannot use is not shown at all - greyed-out controls
  // were noise. Its value is kept, and it is back, still set, on the views that
  // use it. A plain function, not a component, so the control is never remounted.
  const hint = (on: boolean, control: React.ReactElement) => (on ? control : null);

  const loadedRows = [...(data?.rows ?? []), ...extraRows];

  // A customer who ordered in this window but was never seen browsing is still
  // a customer who was active in it - the desktop tracker lists them, and
  // leaving them out is what made the live screen look like it was missing
  // data. They come in with no views rather than with invented ones.
  const ordersBy = orders?.byCompany ?? {};
  const allRows = (() => {
    if (!orders) return loadedRows;
    const known = new Set(loadedRows.map((r) => r.id));
    // These rows came from the orders read, which HubSpot never filtered - see
    // companyPasses, which applies the same five conditions the search applies.
    const want = { mandant, country, apsoCustomer, priority, representative };
    const extra = Object.keys(ordersBy)
      .filter((id) => !known.has(id) && orders.companies[id] && companyPasses(orders.companies[id], want))
      .map((id) => {
        const c = orders.companies[id];
        return {
          id, mandant: c.mandant, customerNumber: c.customerNumber, name: c.name,
          logins: null, views: null, viewsPerLogin: null,
          rangeViews: null, rangeLogins: null, recent: [], revenueYtd: null,
          country: c.country, representative: c.representative,
          apsoCustomer: c.apsoCustomer, salesPriority: c.salesPriority,
          // Known only for companies the activity read returned; an order-only
          // row has not been read for them, so they are null rather than blank
          // strings pretending to be data.
          shortAddress: null, phone: null, usageClass: null,
          deliveryCondition: null, paymentCondition: null,
          history: [],
        };
      });
    return [...loadedRows, ...extra];
  })();
  // Picking "Today" must change WHO is listed, not just the numbers beside them.
  // HubSpot cannot filter inside the JSON, so the narrowing happens here.
  const inPeriod = live
    ? allRows.filter((r) => (r.rangeViews ?? 0) > 0 || (r.rangeLogins ?? 0) > 0 || (ordersBy[r.id]?.orders ?? 0) > 0)

    : allRows;
  const sortValue = (r: (typeof allRows)[number], key: SortKey): string | number => {
    switch (key) {
      case "orders": return ordersBy[r.id]?.orders ?? 0;
      case "orderValue": return ordersBy[r.id]?.value ?? 0;
      case "logins": return (live ? r.rangeLogins : r.logins) ?? 0;
      case "views": return (live ? r.rangeViews : r.views) ?? 0;
      case "viewsPerLogin": return r.viewsPerLogin ?? 0;
      case "revenueYtd": return r.revenueYtd ?? 0;
      default: return (r[key as keyof typeof r] as string | null) ?? "";
    }
  };
  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir(typeof sortValue(allRows[0] ?? ({} as never), key) === "number" ? "desc" : "asc"); }
    setPage(0);
  };

  const minV = Number(minValue.replace(",", ".")) || 0;
  const visible = inPeriod.filter((r) => {
    // Only bites when a figure was typed, so it never hides the customers who
    // browsed without ordering.
    if (minV > 0 && (ordersBy[r.id]?.value ?? 0) < minV) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [r.name, r.customerNumber, r.representative].some((v) => (v ?? "").toLowerCase().includes(needle));
  }).sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sortDir === "desc" ? -cmp : cmp;
  });

  const pageRows = visible.slice(page * perPage, page * perPage + perPage);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = new URLSearchParams(lastQuery);
      q.set("after", cursor);
      const j = await fetch(`/api/datatracker?${q}`).then((r) => r.json());
      if (j?.ok && j.data) {
        setExtraRows((prev) => [...prev, ...(j.data as EshopActivity).rows]);
        setCursor((j.data as EshopActivity).after ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, lastQuery]);

  // Opening a row asks what that customer actually buys. Once per company, and
  // only on open: this is one search each, not one per row on screen.
  useEffect(() => {
    const id = openRow;
    const ask = `${id}|${periodFrom}|${periodTo}`;
    if (!id || askedOrders.current.has(ask)) return;
    askedOrders.current.add(ask);
    let alive = true;
    setOrderedBy((o) => ({ ...o, [id]: "loading" }));
    fetch(`/api/datatracker/ordered?companyId=${encodeURIComponent(id)}&from=${periodFrom}&to=${periodTo}`)
      .then((r) => r.json())
      .then((j) => setOrderedBy((o) => ({ ...o,
        [id]: j?.ok ? { lines: (j.lines ?? []) as OrderLine[], articles: (j.articles ?? []) as string[] } : "error" })))
      .catch(() => { if (alive) setOrderedBy((o) => ({ ...o, [id]: "error" })); });
    return () => { alive = false; };
  }, [openRow, periodFrom, periodTo]);

  // "we need to paginate to show all possible": the server hands back 200 rows
  // at a time, so landing on the last loaded page pulls the next slice instead
  // of ending the customer list at whatever the first request happened to fit.
  useEffect(() => {
    if (!cursor || loadingMore) return;
    if ((page + 1) * perPage >= visible.length) void loadMore();
  }, [page, perPage, visible.length, cursor, loadingMore, loadMore]);

  const sum = useCallback((pick: (r: (typeof visible)[number]) => number | null) =>
    visible.reduce((acc, r) => acc + (pick(r) ?? 0), 0), [visible]);

  // One source at a time. Until the shop has posted its first event there are
  // no daily counters to range over, so the table shows the yearly total and
  // the header says so — rather than four lookalike columns, two of them empty.
  const periodLabel = !live
    ? String(year)
    : period === "custom" ? `${customFrom} → ${customTo}`
    : RANGES.find((r) => r.id === period)?.label ?? "";

  /**
   * Narrower gutters inside the cells, because the default 16px each side was
   * eating half of a short column: "M110" in a 60px cell had 28px to live in
   * and came out as "M1...", while the identical cell on the next row did not.
   * Columns that truncate at different points down the page read as ragged.
   */
  const cell = { borderColor: HAIRLINE, fontSize: "0.78rem", px: 1 };
  /**
   * Fifteen columns do not fit a laptop, and a horizontal scrollbar hides the
   * numbers people came for. The least-asked-for columns step out as the window
   * narrows instead; nothing is lost, the row still opens for the detail.
   */
  const COL = {
    country: { display: { xs: "none", xl: "table-cell" } },
    representative: { display: { xs: "none", lg: "table-cell" } },
    viewsPerLogin: { display: { xs: "none", xl: "table-cell" } },
    trend: { display: { xs: "none", lg: "table-cell" } },
  } as const;



  return (
    // The page sits outside the (site) route group, so it carries its own
    // gutter — nothing above it supplies one and the table ran flush to the rail.
    // Same frame as the UC reports (Erosion): the hub's gutter, the same top
    // padding, and one even gap between blocks.
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2.5 }}>
      <Box>
        <PageHeader title="Datatracker" subtitle="What each customer looked at, priced and ordered in the shop" />
      </Box>

      {/* A segmented control rather than five underlined words: with a count on
          each one the bar says what is waiting before you click anything. The
          frosted bar and its blue selection are Erosion's, so the apps match. */}
      <Box role="tablist" aria-label="Datatracker views"
        sx={{ ...glass, display: "inline-flex", flexWrap: "wrap", gap: 0.5, p: 0.6, borderRadius: "16px",
          boxShadow: "0 1px 2px rgba(31,45,78,.04)", justifySelf: "start", maxWidth: "100%" }}>
        {(() => {
          const views = ([
            ["customers", "Customers", live ? inPeriod.length : null],
            ["articles", "Articles", articles?.rows.length ?? null],
            ["priceCheck", "Price checks", signals ? qualifying.length : null],
            ["moq", "MOQ", signals ? moqRows.length : null],
            ["availability", "Availability", signals ? availabilityRows.length : null],
          ] as [typeof tab, string, number | null][]);
          const move = (from: typeof tab, step: number) => {
            const i = views.findIndex(([id]) => id === from);
            const next = views[(i + step + views.length) % views.length][0];
            selectTab(next);
            document.getElementById(`dt-tab-${next}`)?.focus();
          };
          return views.map(([id, label, count]) => {
            const on = tab === id;
            return (
              <Box key={id} id={`dt-tab-${id}`} role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
                onClick={() => selectTab(id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") { e.preventDefault(); move(id, 1); }
                  if (e.key === "ArrowLeft") { e.preventDefault(); move(id, -1); }
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTab(id); }
                }}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.85, px: 1.75, py: 0.9, borderRadius: "12px",
                  cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                  fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
                  color: on ? "#2459d1" : MUTED,
                  bgcolor: on ? "#e6edfd" : "transparent",
                  transition: "background-color .12s, color .12s",
                  "&:hover": { color: on ? "#2459d1" : INK, bgcolor: on ? "#e6edfd" : "rgba(255,255,255,0.75)" },
                  "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
                }}>
                {label}
                {count != null && (
                  <Typography component="span" sx={{
                    fontSize: "0.72rem", fontWeight: 700, lineHeight: 1, px: 0.75, py: 0.4, borderRadius: "7px",
                    bgcolor: on ? "#ffffff" : "rgba(21,34,58,.06)", color: on ? "#2459d1" : MUTED,
                  }}>{full(count)}</Typography>
                )}
              </Box>
            );
          });
        })()}
      </Box>

      {/* ONE filter bar for every tab. It used to live inside Customers, so
          switching tab took the filters away - the values survived, but you could
          neither see nor change them. Each view shows exactly the filters that
          shape what it shows: Customers all of them; Price checks, MOQ and
          Availability the ones their rows carry; Articles its own sort and the
          search. */}
      <GlassCard>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {/* Articles: which 200 HubSpot sends, so the header arrow follows it -
              otherwise the table says it is sorted by one thing while it was
              fetched by another. */}
          {tab === "articles" && (
            <Select size="small" value={articleSort} sx={{ minWidth: 180 }} aria-label="Sort the articles"
              onChange={(e) => {
                const v = e.target.value as typeof articleSort;
                setArticleSort(v); setArticleSortKey(v); setArticleSortDir("desc"); setArticlePage(0);
              }}>
              <MenuItem value="orders">Most ordered</MenuItem>
              <MenuItem value="companies">Most customers</MenuItem>
              <MenuItem value="stock">Most stock</MenuItem>
            </Select>
          )}
          {/* One control. Pick a range and the live counters answer it; pick a
              year and the Datatracker's own yearly total does. Never both. */}
          {hint(usedHere.period,
            <Select size="small" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 170 }} disabled={!usedHere.period}>
              {RANGES.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
              <MenuItem value="custom">Custom range…</MenuItem>
              <Divider />
              {ESHOP_YEARS.map((y) => <MenuItem key={y} value={`y${y}`}>Full year {y}</MenuItem>)}
            </Select>)}
          {usedHere.period && period === "custom" && (
            <>
              <TextField size="small" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} sx={{ minWidth: 150 }} disabled={!usedHere.period} />
              <TextField size="small" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} sx={{ minWidth: 150 }} disabled={!usedHere.period} />
            </>
          )}
          {hint(usedHere.company,
            <Select size="small" displayEmpty value={mandant} onChange={(e) => setMandant(e.target.value)} sx={{ minWidth: 190 }} disabled={!usedHere.company}>
              <MenuItem value="">All mandants</MenuItem>
              {(options?.mandants ?? []).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </Select>)}
          {hint(usedHere.company,
            <Select size="small" displayEmpty value={country} onChange={(e) => setCountry(e.target.value)} sx={{ minWidth: 160 }} disabled={!usedHere.company}>
              <MenuItem value="">All countries</MenuItem>
              {(options?.countries ?? []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>)}
          {hint(usedHere.selection,
            <Select size="small" displayEmpty value={apsoCustomer} onChange={(e) => setApsoCustomer(e.target.value)} sx={{ minWidth: 180 }} disabled={!usedHere.selection}>
              <MenuItem value="">Any selection criterion</MenuItem>
              {(options?.apsoCustomers ?? []).map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>)}
          {hint(usedHere.selection,
            <Select size="small" displayEmpty value={representative} onChange={(e) => setRepresentative(e.target.value)} sx={{ minWidth: 180 }} disabled={!usedHere.selection}>
              <MenuItem value="">Any representative</MenuItem>
              {(options?.representatives ?? []).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>)}
          {hint(usedHere.company,
            <Select size="small" displayEmpty value={priority} onChange={(e) => setPriority(e.target.value)} sx={{ minWidth: 170 }} disabled={!usedHere.company}>
              <MenuItem value="">Any priority</MenuItem>
              {(options?.priorities ?? []).map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>)}
          {hint(usedHere.sort,
            <Select size="small" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} sx={{ minWidth: 150 }} disabled={!usedHere.sort}>
              {SORTS.map((s) => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
            </Select>)}
          <TextField
            size="small"
            placeholder={tab === "articles" ? "Find an article" : "Find a customer, number or article"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 230 }}
          />
          {hint(usedHere.company,
            <TextField
              size="small"
              type="number"
              placeholder={tab === "customers" ? "Min. order value €" : "Min. value €"}
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              sx={{ minWidth: 170 }}
              disabled={!usedHere.company}
              inputProps={{ min: 0, step: 100, "aria-label": "Minimum value" }}
            />)}
          {tab === "customers" && (
          <Chip
            size="small"
            label={live
              ? `${full(inPeriod.length)} active · ${periodLabel}`
              : `${full(data?.total ?? null)} companies active in ${year}`}
            sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }}
          />
          )}
          {tab === "articles" && articles?.total != null && (
            <Chip size="small" label={`${full(articles.total)} articles match`} sx={{ bgcolor: "#e3edf7", color: "#1b4a80", fontWeight: 600 }} />
          )}
          {tab === "articles" && articlesError && <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18" }}>{articlesError}</Typography>}
          {tab === "customers" && (<>
          {/* A bounded scan must say so. A silent cap reads as "this is the
              whole total" and that is how a wrong number gets published. */}
          {orders?.capped && (
            <Typography sx={{ fontSize: "0.74rem", color: "#9e1b18" }}>
              Orders cut at the {full(orders.scanned)} most recent in this window - pick a shorter period for an exact total.
            </Typography>
          )}
          {/* What the period actually means, which matters more than a row count:
              the live feed only has day-by-day figures from the day it started. */}
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
            Logins and views are counted day by day from 2 October 2026, when the shop started reporting them.
            For anything before that only yearly totals exist, so a date range inside an earlier year cannot be split
            out — pick a full year to see those. Orders and value are exact in any window.
          </Typography>
{/* Not an error and not a cap: these rows are on their way, so this reads
              as progress rather than loss. The tiles count shown rows, so they
              rise as the rest land - saying they were already complete would be
              the kind of small untruth that gets a number republished wrong. */}
          {(orders?.detailTruncated ?? 0) > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
              Largest {full(Object.keys(orders!.companies).length)} customers first - still naming{" "}
              {full(orders!.detailTruncated)} more who ordered in this window. The figures above grow as they arrive.
            </Typography>
          )}
{/* Only `order_channel = eshop` is counted. An ERP or phone order has no
              login and no view behind it, so counting it here produced rows that
              could not happen: orders, no logins, no views. */}
          {(orders?.offChannel ?? 0) > 0 && (
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
              Shop orders only - {full(orders!.offChannel)} of the {full(orders!.scanned)} orders in this window were
              placed outside the shop and are not counted here.
            </Typography>
          )}
          {ordersError && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>Orders: {ordersError}</Typography>}
          {error && <Typography sx={{ fontSize: "0.78rem", color: "#9e1b18" }}>{error}</Typography>}
          </>)}
        </Box>
      </GlassCard>

      {tab === "customers" && (
      <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(5, 1fr)" }, gap: 2 }}>
        <KpiTile icon={<LoginOutlinedIcon />} label={`Logins · ${periodLabel}`} value={full(sum((r) => (live ? r.rangeLogins : r.logins)))} note="Shown rows only" />
        <KpiTile icon={<VisibilityOutlinedIcon />} tint="purple" label={`Views · ${periodLabel}`} value={full(sum((r) => (live ? r.rangeViews : r.views)))} note="Shown rows only" />
        <KpiTile icon={<LayersOutlinedIcon />} tint="slate" label="Views per login" value={decimal(sum((r) => (live ? r.rangeViews : r.views)) / Math.max(1, sum((r) => (live ? r.rangeLogins : r.logins))), 1)} note="How deep a visit goes" />
        {/* Over the SHOWN rows, like the two tiles on the left. Reading the
            whole window here was what made a filtered table sit under an
            unfiltered total. */}
        <KpiTile icon={<ShoppingCartOutlinedIcon />} tint="green" label={`Orders · ${periodLabel}`}
          value={ordersError ? "—" : orders == null ? "…" : full(sum((r) => ordersBy[r.id]?.orders ?? 0))}
          note={ordersError ? "Orders could not be read" : "Shown rows only"} />
        <KpiTile icon={<EuroIcon />} tint="pink" label={`Order value · ${periodLabel}`}
          value={ordersError ? "—" : orders == null ? "…" : `€${compact(sum((r) => ordersBy[r.id]?.value ?? 0))}`}
          note={ordersError ? "Orders could not be read" : "Shown rows only"} />
      </Box>

      <GlassCard sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ "& td, & th": cell, tableLayout: "fixed", width: "100%", minWidth: 0 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36 }} />
{/* ONE line each. A header that wraps to two or three lines sets a
                    different baseline in every column and the row reads as a
                    jumble - so the labels are short enough to fit and the widths
                    count the sort arrow, which is ~18px nobody had budgeted for.
                    Anything shortened keeps its full wording on hover. */}
                {/* Customer has a width of its own. It used to take whatever the
                    other columns left, and at 1440 px beside the app panel that was
                    3 px - the names vanished. Better the table scrolls sideways
                    than the one column that says who it is disappears. */}
                {([["mandant", "Mandant", 76, ""], ["customerNumber", "Customer no.", 112, ""], ["name", "Customer", 200, ""],
                   ["country", "Country", 92, ""], ["representative", "Representative", 136, ""],
                   ["apsoCustomer", "Selection", 104, "Selection criterion"], ["salesPriority", "Priority", 88, ""]] as [SortKey, string, number, string][]).map(([k, h, w, full]) => (
                  <TableCell key={k} title={full || undefined} sx={{ ...HEAD, ...(w ? { width: w } : {}),
                    whiteSpace: "nowrap", verticalAlign: "bottom",
                    ...((COL as Record<string, object>)[k] ?? {}) }} sortDirection={sortKey === k ? sortDir : false}>
                    <TableSortLabel active={sortKey === k} direction={sortKey === k ? sortDir : "asc"} onClick={() => onSort(k)}>
                      {h}
                    </TableSortLabel>
                  </TableCell>
                ))}
                {([["logins", "Logins", 80, ""], ["views", "Views", 74, ""], ["orders", "Orders", 80, ""],
                   ["orderValue", "Value", 90, "Total order value in this period"],
                   ["viewsPerLogin", "Per login", 94, "Views per login"],
                   ["revenueYtd", "Revenue", 96, "Revenue year to date"]] as [SortKey, string, number, string][]).map(([k, h, w, full]) => (
                  <TableCell key={k} align="right" title={full || undefined} sx={{ ...HEAD, width: w,
                    whiteSpace: "nowrap", verticalAlign: "bottom",
                    ...((COL as Record<string, object>)[k] ?? {}) }} sortDirection={sortKey === k ? sortDir : false}>
                    <TableSortLabel active={sortKey === k} direction={sortKey === k ? sortDir : "asc"} onClick={() => onSort(k)}>
                      {h}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell sx={{ ...HEAD, whiteSpace: "nowrap", width: 94, ...COL.trend }}>2021 → 2026</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((r) => [
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }}
                  onClick={() => setOpenRow(openRow === r.id ? null : r.id)}>
                  <TableCell sx={{ px: 0.5 }}>
                    <IconButton size="small" aria-label="Show what this customer looked at" sx={{ p: 0.25 }}>
                      <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED, transform: openRow === r.id ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ color: MUTED, ...clip }}>{r.mandant ?? "—"}</TableCell>
                  <TableCell title={r.customerNumber ?? ""} sx={{ color: MUTED, ...clip }}>{r.customerNumber ?? "—"}</TableCell>
                  {/* A column narrow enough to clip must still give up its value on hover. */}
                  <TableCell title={r.name ?? ""} sx={{ color: INK, fontWeight: 600, ...clip }}>
                    {/* stopPropagation: the row click opens the detail panel, and
                        a link inside it must not do both. */}
                    <Link href={hsCompanyUrl(r.id)} target="_blank" rel="noopener"
                      onClick={(e) => e.stopPropagation()} underline="hover"
                      sx={{ color: INK, fontWeight: 600 }}>
                      {r.name ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell title={r.country ?? ""} sx={{ color: MUTED, ...clip, ...COL.country }}>{r.country ?? "—"}</TableCell>
                  <TableCell title={r.representative ?? ""} sx={{ color: MUTED, ...clip, ...COL.representative }}>{r.representative ?? "—"}</TableCell>
                  <TableCell title={r.apsoCustomer ?? ""} sx={{ color: MUTED, ...clip }}>{r.apsoCustomer ?? "—"}</TableCell>
                  <TableCell sx={{ color: MUTED, ...clip }}>
                    <Tooltip title={r.salesPriority ?? ""} describeChild><span>{shortPriority(r.salesPriority)}</span></Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{full(live ? r.rangeLogins : r.logins)}</TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(live ? r.rangeViews : r.views)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>
                    {orders == null ? "…" : full(ordersBy[r.id]?.orders ?? 0)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: INK, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {orders == null ? "…" : (ordersBy[r.id]?.value ?? 0) === 0 ? "—" : `€${compact(ordersBy[r.id].value)}`}
                  </TableCell>
                  <TableCell align="right" sx={{ color: MUTED, ...COL.viewsPerLogin }}>{r.viewsPerLogin == null ? "—" : decimal(r.viewsPerLogin, 1)}</TableCell>
                  <TableCell align="right" sx={{ color: INK }}>{r.revenueYtd == null ? "—" : `€${compact(r.revenueYtd)}`}</TableCell>
                  <TableCell sx={COL.trend}><YearBars history={r.history} year={year} /></TableCell>
                </TableRow>,
                <TableRow key={`${r.id}-detail`}>
                  <TableCell colSpan={15} sx={{ p: 0, borderBottom: openRow === r.id ? undefined : "none" }}>
                    <Collapse in={openRow === r.id} unmountOnExit>
                      <Box sx={{ p: 2, bgcolor: "#eef3fa", borderLeft: "3px solid #1b4a80",
                        boxShadow: "inset 0 1px 0 rgba(27,74,128,0.14), inset 0 -1px 0 rgba(27,74,128,0.14)" }}>
                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, mb: 1 }}>
                          What {r.name ?? "this customer"} looked at and ordered
                          {"  "}
                          <Link href={hsCompanyUrl(r.id)} target="_blank" rel="noopener"
                            onClick={(e) => e.stopPropagation()} underline="hover"
                            sx={{ ml: 1, fontSize: "0.72rem", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                            Open in HubSpot ↗
                          </Link>
                        </Typography>
                        <>
                          {/* Never gate this on the VIEW feed. Metrohm AG placed the
                                largest order of 2 October against one login and zero
                                views, and gating here is what showed "nothing recorded"
                                on a customer who had just spent 4,907. */}
                            {/* The desktop tracker's remaining columns. They belong here
                            rather than in the table: they are read when you look at one
                            customer, not scanned down a list. */}
                        {(r.shortAddress || r.phone || r.usageClass || r.deliveryCondition || r.paymentCondition) ? (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px 22px", mb: 1.5, fontSize: "0.76rem" }}>
                            {([["Address", r.shortAddress], ["Phone", r.phone], ["Usage class", r.usageClass],
                               ["Delivery", r.deliveryCondition], ["Payment", r.paymentCondition]] as [string, string | null][])
                              .filter(([, v]) => !!v)
                              .map(([k, v]) => (
                                <Box key={k} component="span">
                                  <Box component="span" sx={{ color: MUTED }}>{k}: </Box>
                                  <Box component="span" sx={{ color: INK, fontWeight: 600 }}>{v}</Box>
                                </Box>
                              ))}
                          </Box>
                        ) : null}
                        <RecentLines lines={r.recent} ordered={orderedBy[r.id]} />
                        </>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>,
              ]).flat()}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
                    {data ? "No customer matches these filters." : "Reading the shop's activity…"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={visible.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={perPage}
          rowsPerPageOptions={[25, 50, 100]}
          onRowsPerPageChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
          labelRowsPerPage="Customers per page"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} of ${full(count)}${cursor ? "+" : ""}${loadingMore ? " - loading more" : ""}`}
          sx={{ borderTop: `1px solid ${HAIRLINE}` }}
        />
      </GlassCard>

      </>
      )}

      {tab === "articles" && (
        <GlassCard sx={{ p: 0, overflow: "hidden" }}>
          {/* Its sort, search and match count sit in the filter bar above. */}
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ "& td, & th": cell }}>
              <TableHead>
                {/* "Ordered by" counted customers and so did "Customers", two
                    columns apart and differently named. They are the same unit -
                    customers - so they carry the same word, and the band above
                    says which half of the screen each belongs to. */}
                <TableRow>
                  <TableCell colSpan={4} sx={{ borderBottom: "none" }} />
                  <TableCell colSpan={5} align="center" sx={{ borderBottom: "none", fontWeight: 700, fontSize: "0.68rem",
                    letterSpacing: "0.06em", textTransform: "uppercase", color: "#1b4a80" }}>In the shop · since 2 Oct</TableCell>
                  <TableCell colSpan={3} align="center" sx={{ borderBottom: "none", fontWeight: 700, fontSize: "0.68rem",
                    letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>ERP · all time</TableCell>
                </TableRow>
                <TableRow>
                  {([["articleNumber", "Article no.", 108], ["description", "Description", 0],
                     ["mainGroup", "Main group", 152], ["articleType", "Type", 88]] as [ArticleSortKey, string, number][]).map(([k, h, w]) => (
                    <TableCell key={k} sx={{ ...HEAD, whiteSpace: "nowrap", ...(w ? { width: w } : {}) }}
                      sortDirection={articleSortKey === k ? articleSortDir : false}>
                      <TableSortLabel active={articleSortKey === k} direction={articleSortKey === k ? articleSortDir : "asc"}
                        onClick={() => onArticleSort(k)}>{h}</TableSortLabel>
                    </TableCell>
                  ))}
                  {([["views", "Looked at", 86], ["lookedBy", "Customers", 94], ["carts", "In cart", 78],
                     ["topQty", "Max qty", 86], ["lastLooked", "Last look", 124],
                     ["orders", "Orders", 86], ["companies", "Customers", 94], ["stock", "Stock", 110]] as [ArticleSortKey, string, number][]).map(([k, h, w], i) => (
                    <TableCell key={`${k}-${i}`} align="right" sx={{ ...HEAD, whiteSpace: "nowrap", width: w }}
                      sortDirection={articleSortKey === k ? articleSortDir : false}>
                      <TableSortLabel active={articleSortKey === k} direction={articleSortKey === k ? articleSortDir : "asc"}
                        onClick={() => onArticleSort(k)}>{h}</TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {articlePageRows.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{a.articleNumber ?? "—"}</TableCell>
                    <TableCell sx={{ color: INK }}>{a.description ?? "—"}</TableCell>
                    <TableCell sx={{ color: MUTED }}>{a.mainGroup ?? "—"}</TableCell>
                    <TableCell sx={{ color: MUTED }}>{a.articleType ?? "—"}</TableCell>
                    {/* What the shop reported, first: it is the live half of this screen. */}
                    <TableCell align="right" sx={{ color: a.views ? INK : MUTED, fontWeight: a.views ? 700 : 400 }}>
                      {a.views == null ? "—" : full(a.views)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: a.lookedBy ? INK : MUTED }}>
                      {a.lookedBy == null ? "—" : full(a.lookedBy)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: a.carts ? INK : MUTED, fontWeight: a.carts ? 600 : 400 }}>
                      {a.carts ? full(a.carts) : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ color: MUTED }}>{a.topQty == null ? "—" : decimal(a.topQty, 0)}</TableCell>
                    <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                      {a.lastLooked ? a.lastLooked.replace("T", " ") : "—"}
                    </TableCell>
                    {/* then the ERP counts, which are all-time */}
                    <TableCell align="right" sx={{ color: INK, fontWeight: 700 }}>{full(a.orders)}</TableCell>
                    <TableCell align="right" sx={{ color: INK }}>{full(a.companies)}</TableCell>
                    <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                      {a.stock == null ? "—" : `${full(a.stock)}${a.stockUnit ? ` ${a.stockUnit}` : ""}`}
                    </TableCell>
                  </TableRow>
                ))}
                {articles && articleRows.length === 0 && (
                  <TableRow><TableCell colSpan={12} sx={{ color: MUTED, py: 3, textAlign: "center" }}>No article matches.</TableCell></TableRow>
                )}
                {!articles && !articlesError && (
                  <TableRow><TableCell colSpan={12} sx={{ color: MUTED, py: 3, textAlign: "center" }}>Reading the articles…</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div"
            count={articleRows.length}
            page={articlePage}
            onPageChange={(_, p) => setArticlePage(p)}
            rowsPerPage={articlePerPage}
            rowsPerPageOptions={[25, 50, 100]}
            onRowsPerPageChange={(e) => { setArticlePerPage(Number(e.target.value)); setArticlePage(0); }}
            labelRowsPerPage="Rows"
            sx={{ borderTop: `1px solid ${HAIRLINE}` }}
          />
          {/* Loading the next page from HubSpot, not just turning a page of what
              is already here - 128,000 articles do not arrive in one read. */}
          {articles?.after && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Button size="small" variant="outlined" onClick={loadMoreArticles} disabled={articlesLoadingMore}>
                {articlesLoadingMore ? "Reading…" : `Load the next ${full(200)} articles`}
              </Button>
            </Box>
          )}
          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
              <strong>Looked at, Customers, In cart, Max qty and Last look come from the shop as it happens</strong> — off the
              price lookup the page makes when a customer picks a size and a quantity, so they cover every signed-in customer
              whatever they chose on the cookie banner. They start on 2 October, when that capture went live.
              {" "}<strong>Orders, Customers and Stock on the right are ERP counts</strong> from Products &amp; Pricing, written every night and
              covering all time. A dash under the shop columns means nobody has priced that article since the capture started.
              {articles?.viewsError ? ` The shop figures could not be read: ${articles.viewsError}` : ""}
            </Typography>
          </Box>
        </GlassCard>
      )}

      {tab === "priceCheck" && (
        <GlassCard sx={{ p: 0, overflow: "hidden" }}>
          <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label={`${full(qualifying.length)} qualify`}
              sx={{ bgcolor: "#e6f4ec", color: "#0f7b4f", fontWeight: 700 }} />
            <Chip size="small" label={`${full(signals ? pcRows.length - qualifying.length : null)} below the rule`}
              sx={{ bgcolor: "#eef1f5", color: MUTED, fontWeight: 600 }} />
            <FormControlLabel
              control={<Switch size="small" checked={pcOnlyQualifying} onChange={(e) => setPcOnlyQualifying(e.target.checked)} />}
              label={<Typography sx={{ fontSize: "0.82rem", color: MUTED }}>Only the ones that qualify</Typography>}
            />
            {signalsError && <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18" }}>{signalsError}</Typography>}
            <Box sx={{ flex: 1 }} />
            {/* The Datatracker records what happened; raising the tickets is the UC
                app's job (UC & HubSpot Apps -> Price check tickets), so it is a link here,
                not a second Create button that could disagree with the first. */}
            <Button size="small" variant="outlined" component="a" href="/uc/price-checks">
              Tickets are raised in Price check tickets →
            </Button>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ "& td, & th": cell }}>
              <TableHead>
                <TableRow>
                  {["Day", "Customer", "Mandant", "Owner", "Priority", "Articles", "Counted", "Value", "Judged on", "Verdict", "Ticket"]
                    .map((h, i) => (
                      <TableCell key={h} align={i >= 5 && i <= 7 ? "right" : "left"}
                        sx={{ ...HEAD, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pcVisible.map((r) => [
                  <TableRow key={`${r.companyId}-${r.day}`} hover sx={{ cursor: "pointer" }}
                    onClick={() => setPcOpen(pcOpen === `${r.companyId}-${r.day}` ? null : `${r.companyId}-${r.day}`)}>
                    <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>{r.day}</TableCell>
                    <TableCell sx={{ color: INK, fontWeight: 600, ...clip }} title={r.companyName ?? ""}>
                      <Link href={hsCompanyUrl(r.companyId)} target="_blank" rel="noopener"
                        onClick={(e) => e.stopPropagation()} underline="hover" sx={{ color: INK, fontWeight: 600 }}>
                        {r.companyName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ color: MUTED }}>{r.mandant ?? "—"}</TableCell>
                    {/* Who would get it. An owner on neither roster gets no
                        ticket at all, and that has to be visible here or the
                        screen promises a call nobody is going to make. */}
                    <TableCell sx={{ color: r.team ? MUTED : "#9e1b18", ...clip }} title={r.owner || ""}>
                      {r.owner || "no owner"}{r.team ? "" : " · off roster"}
                    </TableCell>
                    <TableCell sx={{ color: MUTED }}>{shortPriority(r.salesPriority)}</TableCell>
                    <TableCell align="right" sx={{ color: INK }}>{full(r.articles.length)}</TableCell>
                    <TableCell align="right" sx={{ color: r.counted ? INK : MUTED, fontWeight: 600 }}>{full(r.counted)}</TableCell>
                    <TableCell align="right" sx={{ color: INK, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {r.value ? `€${compact(r.value)}` : "—"}
                    </TableCell>
                    <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                      {r.gateOpen ? r.dueOn : `due ${r.dueOn}`}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {/* The reason, never a bare no: a rule you cannot see the
                          edge of is a rule nobody trusts. */}
                      <Typography component="span" sx={{
                        fontSize: "0.72rem", fontWeight: 700, px: 0.9, py: 0.3, borderRadius: 1,
                        bgcolor: r.excluded ? "#f3f0ff" : r.qualifies ? "#e6f4ec" : "#eef1f5",
                        color: r.excluded ? "#5a3fa0" : r.qualifies ? "#0f7b4f" : MUTED,
                      }}>
                        {r.excluded ? r.excluded
                          : r.qualifies ? (r.gateOpen ? "Qualifies" : "Qualifies · waiting")
                          : r.counted === 0 ? "No KT/DT article"
                          : "Under €500"}
                      </Typography>
                    </TableCell>
                    {/* Read back from HubSpot, not assumed. The detector runs on
                        the connector; if a row qualifies here and has no ticket
                        there, the two have drifted and this is where it shows. */}
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {r.ticketId
                        ? <Link href={hsTicketUrl(r.ticketId)} target="_blank" rel="noopener"
                            onClick={(e) => e.stopPropagation()} underline="hover"
                            sx={{ fontSize: "0.76rem", fontWeight: 600 }}>raised ↗</Link>
                        : r.qualifies && !r.excluded && r.gateOpen
                          ? <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>next run</Typography>
                          : <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>—</Typography>}
                    </TableCell>
                  </TableRow>,
                  pcOpen === `${r.companyId}-${r.day}` && (
                    <TableRow key={`${r.companyId}-${r.day}-d`}>
                      <TableCell colSpan={11} sx={{ p: 0, bgcolor: "#f7f9fc" }}>
                        <Box sx={{ p: 2 }}>
                          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
                            textTransform: "uppercase", color: MUTED, mb: 1 }}>
                            Priced and left behind · {r.contactIds.length > 0
                              ? `${full(r.contactIds.length)} contact${r.contactIds.length > 1 ? "s" : ""} identified`
                              : "contact not identified"}
                          </Typography>
                          <Table size="small" sx={{ "& td, & th": cell, "& tbody tr:nth-of-type(odd)": { bgcolor: "#eef3f9" } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ ...HEAD, width: 110 }}>Article</TableCell>
                                <TableCell sx={{ ...HEAD }}>Description</TableCell>
                                <TableCell sx={{ ...HEAD, width: 74 }}>PC</TableCell>
                                <TableCell align="right" sx={{ ...HEAD, width: 80 }}>Qty</TableCell>
                                <TableCell sx={{ ...HEAD, width: 124 }}>Unit · MOQ</TableCell>
                                <TableCell align="right" sx={{ ...HEAD, width: 94 }}>Price</TableCell>
                                <TableCell align="right" sx={{ ...HEAD, width: 98 }}>Value</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {r.articles.map((a) => (
                                <TableRow key={a.article}>
                                  <TableCell sx={{ fontWeight: 600, color: a.counted ? INK : MUTED, whiteSpace: "nowrap" }}>{a.article}</TableCell>
                                  <TableCell sx={{ color: MUTED, ...clip }} title={a.description ?? ""}>{a.description ?? "—"}</TableCell>
                                  <TableCell sx={{ color: a.counted ? INK : MUTED }}>
                                    {a.special ? "special" : a.profitCentre ?? "—"}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: INK }}>{a.qty == null ? "—" : full(a.qty)}</TableCell>
                                  {/* A quantity means little without these: 20 of
                                      something sold per metre is not 20 pieces,
                                      and a request under a MOQ is one the shop
                                      would have bumped. */}
                                  <TableCell sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                                    {[a.salesUnit ?? "unit ?",
                                      a.moq == null ? "MOQ unknown" : /^y/i.test(a.moq) ? `MOQ ${a.moqMinimum ?? "?"}` : "no MOQ",
                                    ].join(" · ")}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: MUTED, whiteSpace: "nowrap" }}>
                                    {a.price == null ? "—" : `€${decimal(a.price, 2)}`}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: a.counted ? INK : MUTED, fontWeight: a.counted ? 700 : 400, whiteSpace: "nowrap" }}>
                                    {a.value == null ? "—" : `€${compact(a.value)}`}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ),
                ])}
                {signals && pcVisible.length === 0 && (
                  <TableRow><TableCell colSpan={11} sx={{ color: MUTED, py: 3, textAlign: "center" }}>
                    Nobody priced without carting in this window.
                  </TableCell></TableRow>
                )}
                {!signals && !signalsError && (
                  <TableRow><TableCell colSpan={11} sx={{ color: MUTED, py: 3, textAlign: "center" }}>Reading the shop activity…</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
              <strong>When a price check becomes a ticket.</strong> A customer asked us what something costs and
              did not buy it. That is a question still open, and the ticket is somebody being asked to close it.
              <br /><br />
              <strong>One ticket per customer per day</strong>, listing everything they priced that day — not one per
              article, or a rep gets five conversations about the same visit. It carries each article with the
              quantity they asked for, its unit and its minimum order quantity, the value at list price, and the
              contact who did the pricing, so the call can start from what they wanted rather than from a lookup.
              <br /><br />
              <strong>It goes to the company&rsquo;s owner</strong>, into their ESO or TSA queue at New. An owner on
              neither roster gets no ticket at all — that row says so rather than promising a call nobody will make.
              <br /><br />
              <strong>Not every price check earns one.</strong> We count plastics and sealings (KT and DT), because
              those are the ones this team sells; a 3xxx or 8xxx special is left out, since we hold no price or
              profit centre for it and would be guessing. The day has to be worth the call at <strong>€500</strong>
              of list value — a floor, so three cheap articles still is not one. <strong>APSOmicro</strong> and
              <strong> priorities 3 and 4</strong> are not chased at all.
              <br /><br />
              <strong>And we wait a working day.</strong> People buy the next morning. A Friday afternoon tells you
              nothing until Monday, so a Friday check is judged on the Monday and never on the Saturday. If the order
              arrives in that window the question answered itself and nobody is called. Public holidays are not in
              the calendar yet, only weekends.
            </Typography>
          </Box>
        </GlassCard>
      )}

      {tab === "moq" && (
        <GlassCard sx={{ p: 0, overflow: "hidden" }}>
          <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label={`${full(signals ? moqRows.filter((r) => r.belowMoq).length : null)} asked below the minimum`}
              sx={{ bgcolor: "#fdf0e6", color: "#b26a00", fontWeight: 700 }} />
            <Chip size="small" label={`${full(signals ? moqRows.length : null)} looks on articles with a minimum`}
              sx={{ bgcolor: "#eef1f5", color: MUTED, fontWeight: 600 }} />
            {signalsError && <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18" }}>{signalsError}</Typography>}
          </Box>
          {!signals && !signalsError
            ? <Box sx={{ p: 3 }}><Typography sx={{ color: MUTED, fontSize: "0.85rem" }}>Reading the shop activity…</Typography></Box>
            : <LookTable rows={moqRows} kind="moq" mandantOf={(r) => r.mandant ?? ""} />}
          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
              No ticket comes out of this one — it is a record. Somebody wanted an article we only sell from a minimum
              quantity, and did not buy it. The rows at the top are the ones where they asked for <em>less</em> than that
              minimum, which is the version we can do something about: either the minimum is wrong for that article, or
              there was a neighbour we should have offered. Open a row and the hub looks for one — same sub-group,
              actually on the shelf, and sold in the quantity they wanted. &ldquo;Would have covered it&rdquo; means exactly that.
            </Typography>
          </Box>
        </GlassCard>
      )}

      {tab === "availability" && (
        <GlassCard sx={{ p: 0, overflow: "hidden" }}>
          <Box sx={{ p: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label={`${full(signals ? availabilityRows.filter((r) => r.stock === 0).length : null)} with nothing on the shelf`}
              sx={{ bgcolor: "#fdecea", color: "#9e1b18", fontWeight: 700 }} />
            <Chip size="small" label={`${full(signals ? availabilityRows.length : null)} looks we could not have filled`}
              sx={{ bgcolor: "#eef1f5", color: MUTED, fontWeight: 600 }} />
            {signalsError && <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18" }}>{signalsError}</Typography>}
          </Box>
          {!signals && !signalsError
            ? <Box sx={{ p: 3 }}><Typography sx={{ color: MUTED, fontSize: "0.85rem" }}>Reading the shop activity…</Typography></Box>
            : <LookTable rows={availabilityRows} kind="availability" mandantOf={(r) => r.mandant ?? ""} />}
          <Box sx={{ p: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
              Also a record, not a ticket. Somebody priced an article we had none of, or less of than they asked for,
              and did not buy. The gap is worth seeing on its own — it is the one reason for a lost sale we can fix by
              ordering stock. Open a row for what we could have offered instead. An article whose stock we simply do not
              know is left out: a blank is not a zero, and treating it as one would invent a shortage.
            </Typography>
          </Box>
        </GlassCard>
      )}
    </Box>
  );
}
