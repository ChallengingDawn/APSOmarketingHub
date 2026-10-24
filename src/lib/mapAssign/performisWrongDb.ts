// MAP ASSIGNMENT - Wrong Performis owners, from the engine's table (performisWrong.ts decides each row): the page's
// counts and pages (GET ?performisWrong=1) and the Excel export (GET ?performisWrong=1&format=xlsx) - the Performis
// corrections, and every company whose owner or region in HubSpot differ from the rules (SARCLA 24.10.2026: "allow
// export of all wrong owners").

import { query } from "@/lib/db/client";
import { xlsx, type Cell, type Column } from "@/lib/xlsx";
import { ensureMapAssign, getRules, owners } from "./engine";
import { WRONG_ORDER, WRONG_TEXT, performisFix, spellings, type PerformisWrongData, type WrongReason, type WrongRow } from "./performisWrong";

const PAGE = 50;
const hubspotCompanyUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
type Db = {
  company_id: string; name: string | null; country: string | null; zip: string | null; sae: string | null; erp_id: string | null;
  owner_now: string | null; region_now: string | null; owner_decided: string; via: string; detail: string | null; flags: string[] | null;
};

async function all(): Promise<{ rows: WrongRow[]; wrong: Db[]; name: (o: string | null) => string }> {
  await ensureMapAssign();
  const [rules, own] = [(await getRules()).value, await owners()];
  const name = (o: string | null) => (o ? own.names.get(String(o)) ?? `#${o}` : "");
  const sp = spellings(rules, (o) => name(o));
  const r = await query<Db>(`SELECT company_id, name, country, zip, sae, erp_id, owner_now, region_now, owner_decided, via, detail, flags FROM apsomh_map_assign`);
  const rows: WrongRow[] = [];
  const wrong: Db[] = [];
  for (const x of r.rows) {
    if ((x.owner_now ?? "") !== x.owner_decided || (x.region_now ?? "") !== x.owner_decided) wrong.push(x);
    const f = performisFix({ sae: x.sae, erpId: x.erp_id, country: x.country, decided: x.owner_decided, flags: x.flags }, rules, sp, (o) => name(o), (o) => own.active.has(String(o)));
    if (f) rows.push({ id: String(x.company_id), name: x.name ?? `Company ${x.company_id}`, erpId: x.erp_id, country: x.country, zip: x.zip, sae: x.sae, write: f.write, reason: f.reason, decided: x.owner_decided, ownerNow: x.owner_now });
  }
  const order = new Map(WRONG_ORDER.map((k, i) => [k, i]));
  rows.sort((a, b) => (order.get(a.reason) ?? 99) - (order.get(b.reason) ?? 99) || String(a.country ?? "~").localeCompare(String(b.country ?? "~")) || a.name.localeCompare(b.name));
  return { rows, wrong, name };
}

export async function performisWrong(f: { country?: string | null; reason?: string | null; q?: string | null; offset?: number }): Promise<PerformisWrongData> {
  const { rows, wrong } = await all();
  const byReason: Partial<Record<WrongReason, number>> = {};
  const byCountry: Record<string, number> = {};
  for (const x of rows) { byReason[x.reason] = (byReason[x.reason] ?? 0) + 1; const c = x.country ?? "??"; byCountry[c] = (byCountry[c] ?? 0) + 1; }
  const q = String(f.q ?? "").trim().toLowerCase();
  const shown = rows.filter((x) => (!f.country || (x.country ?? "??") === f.country) && (!f.reason || x.reason === f.reason)
    && (!q || x.name.toLowerCase().includes(q) || String(x.erpId ?? "").includes(q) || String(x.sae ?? "").toLowerCase().includes(q)));
  const offset = Math.max(0, Math.floor(Number(f.offset) || 0));
  return { total: rows.length, byReason, byCountry, filtered: shown.length, offset, rows: shown.slice(offset, offset + PAGE), wrongOwners: wrong.length };
}

/** The Excel file: a summary, the Performis corrections, and the wrong owners in HubSpot - every country, every row. */
export async function performisWrongXlsx(): Promise<Buffer> {
  const { rows, wrong, name } = await all();
  const stamp = new Date().toLocaleString("en-GB", { timeZone: "Europe/Zurich" });
  const countries = [...new Set(rows.map((x) => x.country ?? "??"))].sort((a, b) => rows.filter((x) => (x.country ?? "??") === b).length - rows.filter((x) => (x.country ?? "??") === a).length);
  const summary: Cell[][] = WRONG_ORDER.filter((k) => rows.some((x) => x.reason === k)).map((k) => {
    const of = rows.filter((x) => x.reason === k);
    return [WRONG_TEXT[k].title, WRONG_TEXT[k].why, of.length, ...countries.map((c) => of.filter((x) => (x.country ?? "??") === c).length || null)];
  });
  summary.push(["All", "", rows.length, ...countries.map((c) => rows.filter((x) => (x.country ?? "??") === c).length)]);
  const sumCols: Column[] = [{ header: "Why", width: 34 }, { header: "What it means", width: 70 }, { header: "Companies", width: 11, format: "int" }, ...countries.map((c) => ({ header: c === "??" ? "no country" : c, width: 9, format: "int" as const }))];
  const fixCols: Column[] = [
    { header: "Why", width: 30 }, { header: "Country", width: 9 }, { header: "Company", width: 40 }, { header: "ERP id", width: 11 }, { header: "Zip", width: 9 },
    { header: "SAE in Performis now", width: 24 }, { header: "Write in Performis", width: 24 }, { header: "Owner by the rules", width: 22 }, { header: "Owner in HubSpot now", width: 22 },
    { header: "HubSpot", width: 60 }, { header: "Company id", width: 14 },
  ];
  const fixRows: Cell[][] = rows.map((x) => [WRONG_TEXT[x.reason].title, x.country ?? "", x.name, x.erpId ?? "", x.zip ?? "", x.sae ?? "", x.write, name(x.decided), name(x.ownerNow) || "nobody", hubspotCompanyUrl(x.id), x.id]);
  const ownCols: Column[] = [
    { header: "Country", width: 9 }, { header: "Company", width: 40 }, { header: "ERP id", width: 11 }, { header: "Zip", width: 9 }, { header: "SAE in Performis", width: 24 },
    { header: "Owner in HubSpot now", width: 22 }, { header: "Region responsibility now", width: 22 }, { header: "Owner by the rules", width: 22 }, { header: "Why the rules give it", width: 50 },
    { header: "HubSpot", width: 60 }, { header: "Company id", width: 14 },
  ];
  const ownRows: Cell[][] = wrong.sort((a, b) => String(a.country ?? "~").localeCompare(String(b.country ?? "~")) || String(a.name ?? "").localeCompare(String(b.name ?? "")))
    .map((x) => [x.country ?? "", x.name ?? `Company ${x.company_id}`, x.erp_id ?? "", x.zip ?? "", x.sae ?? "", name(x.owner_now) || "nobody", name(x.region_now) || "empty", name(x.owner_decided), x.detail ?? "", hubspotCompanyUrl(String(x.company_id)), String(x.company_id)]);
  return xlsx([
    { name: "Summary", columns: sumCols, rows: summary, table: false, preamble: [`Wrong Performis owners - Map assignment, ${stamp}`, "Performis customers (ERP id) whose SAE does not name the person the rules give them: write the SAE of the sheet \"Performis to correct\" in Performis - the ERP sync brings it to HubSpot."] },
    { name: "Performis to correct", columns: fixCols, rows: fixRows },
    { name: "Wrong owners in HubSpot", columns: ownCols, rows: ownRows, preamble: [`Companies whose owner or region responsibility in HubSpot differ from the rules - ${stamp}`] },
  ]);
}
