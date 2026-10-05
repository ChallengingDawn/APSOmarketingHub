// Articles CY/LY as a file: Excel (Summary + every article, or the top and flop
// 20 the screen shows) or an Excel-friendly CSV.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { loadReport } from "@/lib/integrations/articleReport";
import { filterRows, kpis, movers, type ArticleRow } from "@/lib/articles/model";
import { csv, xlsx, type Cell, type Column } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await loadReport();
  if (!report) return NextResponse.json({ error: "The report has not been built yet." }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const pc = sp.get("pc");
  const q = sp.get("q");
  const rows = filterRows(report.rows, { pc, q });
  const { cy, ly } = report;
  const asOf = `${report.today.slice(8, 10)}.${report.today.slice(5, 7)}`;

  const columns: Column[] = [
    { header: "Article", width: 13 }, { header: "Description", width: 48 }, { header: "PC", width: 6 },
    { header: `${cy} to ${asOf}`, width: 14, format: "money" }, { header: `${ly} to ${asOf}`, width: 14, format: "money" },
    { header: "Change", width: 13, format: "money" }, { header: "Change %", width: 9, format: "pct1" },
    { header: `${ly} full year`, width: 14, format: "money" },
    { header: `Companies ${cy}`, width: 11, format: "int" }, { header: `Companies ${ly} to ${asOf}`, width: 13, format: "int" },
    { header: "Countries", width: 20 },
    { header: `Qty ${cy}`, width: 11, format: "int" }, { header: `Qty ${ly} to ${asOf}`, width: 12, format: "int" },
    { header: `Lines ${cy}`, width: 9, format: "int" }, { header: `Lines ${ly} to ${asOf}`, width: 11, format: "int" },
  ];
  const line = (r: ArticleRow): Cell[] => [
    r.article, r.description, r.pc, r.revenueCy, r.revenueLyYtd, r.delta, r.deltaPct, r.revenueLy,
    r.customersCy, r.customersLyYtd, r.countries, r.qtyCy, r.qtyLyYtd, r.linesCy, r.linesLyYtd,
  ];
  const filterNote = [pc ? `profit centre ${pc}` : "", q ? `search "${q}"` : ""].filter(Boolean).join(" · ");
  const basis = `Each order counted once (as placed, or as delivered where that is more); ${cy} to date against the same days of ${ly}. Built ${report.generated.slice(0, 16).replace("T", " ")} UTC from ${report.ordersRead} order documents.`;
  const stamp = report.today;

  if (sp.get("format") === "csv") {
    return new NextResponse(new Uint8Array(csv(columns, rows.map(line))), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="articles-cy-ly-${stamp}.csv"` },
    });
  }

  let file: Buffer;
  if (sp.get("movers") === "1") {
    const m = movers(rows);
    file = xlsx([
      { name: "Top 20", columns, rows: m.top.map(line), preamble: [`Top 20 - growing most, ${cy} vs ${ly} to ${asOf}${filterNote ? ` · ${filterNote}` : ""}`, basis] },
      { name: "Flop 20", columns, rows: m.flop.map(line), preamble: [`Flop 20 - falling most, ${cy} vs ${ly} to ${asOf}${filterNote ? ` · ${filterNote}` : ""}`, basis] },
    ]);
  } else {
    const k = kpis(rows);
    const summary: Cell[][] = [
      [`Revenue ${cy} to ${asOf}`, k.totalCy], [`Revenue ${ly} to ${asOf}`, k.totalLyYtd], ["Change, like for like", k.delta],
      ["Change %", k.deltaPct], [`Revenue ${ly}, full year`, k.totalLy], ["Articles", k.articles], ["Growing", k.gainers], ["Falling", k.losers],
      [`New - sold in ${cy}, not at all in ${ly}`, k.newArticles], ["EUR on those", k.newRevenueCy],
      [`Gone quiet - sold by ${asOf} in ${ly}, nothing in ${cy}`, k.lostArticles], [`${ly} EUR on those`, k.lostRevenueLyYtd],
      [null, null], ["By profit centre", null],
      ...k.byPc.map((p): Cell[] => [`${p.pc} - ${p.n} articles`, p.delta]),
    ];
    file = xlsx([
      {
        name: "Summary", table: false,
        columns: [{ header: "", width: 52 }, { header: "", width: 16, format: "money" }],
        rows: summary,
        preamble: [`Articles CY/LY - ${cy} vs ${ly} to ${asOf}${filterNote ? ` · ${filterNote}` : ""}`, basis],
      },
      { name: "Articles", columns, rows: rows.map(line) },
    ]);
  }
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="articles-cy-ly-${sp.get("movers") === "1" ? "top-flop-" : ""}${stamp}.xlsx"`,
    },
  });
}
