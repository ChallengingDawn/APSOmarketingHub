// Reading the customer-journey workbook.
//
// The sheet is a matrix: the first column names a row ("Buyer Mindset",
// "Typical Drop-off Risks", "KPIs to put in place"), and every column to the
// right is a step of the journey. The five stage names sit on the first row,
// each above the first step it covers, so a stage owns every column up to the
// next stage name.
//
// Nothing is guessed. A row the workbook does not have is null in the model and
// reported as a warning, never filled in with something plausible.

import ExcelJS from "exceljs";
import {
  JOURNEY_ROWS,
  slug,
  type JourneyFunnel,
  type JourneyIssue,
  type JourneyModel,
  type JourneyRowKey,
  type JourneyStage,
  type JourneyStep,
} from "./model";

const JOURNEY_SHEET = "Customer Journey";
const FUNNEL_SHEET = "KPIsNeeded";
const MAX_COLUMNS = 40;

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null && "richText" in (value as object)) {
    const rich = (value as { richText?: { text?: string }[] }).richText ?? [];
    const joined = rich.map((r) => r.text ?? "").join("").trim();
    return joined.length ? joined : null;
  }
  const s = String(value).trim();
  return s.length ? s : null;
};

/** Find the row whose first cell starts with this label; the workbook's wording drifts. */
function findRow(rows: (string | null)[][], label: string): number | null {
  const wanted = label.toLowerCase();
  for (let r = 0; r < rows.length; r++) {
    const first = (rows[r][0] ?? "").toLowerCase();
    if (first.startsWith(wanted)) return r + 1;
  }
  return null;
}

export async function parseJourneyWorkbook(
  buffer: ArrayBuffer,
  meta: { fileName: string; importedBy: string },
): Promise<JourneyModel> {
  const issues: JourneyIssue[] = [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheet = wb.getWorksheet(JOURNEY_SHEET) ?? wb.worksheets[0];
  if (!sheet) {
    throw new Error(`The file has no worksheets. Expected a sheet named "${JOURNEY_SHEET}".`);
  }
  if (sheet.name !== JOURNEY_SHEET) {
    issues.push({
      severity: "warning",
      where: "workbook",
      message: `No sheet named "${JOURNEY_SHEET}"; read "${sheet.name}" instead. Check the result below before applying.`,
    });
  }

  // The grid, as plain strings.
  const rows: (string | null)[][] = [];
  const width = Math.min(sheet.columnCount || MAX_COLUMNS, MAX_COLUMNS);
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row: (string | null)[] = [];
    for (let c = 1; c <= width; c++) row.push(text(sheet.getRow(r).getCell(c).value));
    rows.push(row);
  }

  // Row 1 carries the stage names. A stage header is merged across the columns
  // it covers, and a merged cell reads back with the same value in every one of
  // them — so a repeat of the previous name continues that stage, it does not
  // start a new one.
  const stageCols: { name: string; column: number }[] = [];
  let previousName: string | null = null;
  for (let c = 2; c <= width; c++) {
    const name = rows[0]?.[c - 1];
    if (name && name !== previousName) stageCols.push({ name, column: c });
    if (name) previousName = name;
  }
  if (!stageCols.length) {
    issues.push({ severity: "error", where: "row 1", message: "No stage names found on the first row; the sheet does not look like the journey matrix." });
  }

  const rowMap: { field: JourneyRowKey; label: string; row: number }[] = [];
  const rowOf = (field: JourneyRowKey): number | null => {
    const found = findRow(rows, JOURNEY_ROWS[field]);
    if (found) rowMap.push({ field, label: JOURNEY_ROWS[field], row: found });
    else issues.push({ severity: "warning", where: JOURNEY_ROWS[field], message: `Row "${JOURNEY_ROWS[field]}" is missing from the sheet; that field stays empty.` });
    return found;
  };

  const cell = (row: number | null, column: number): string | null =>
    row === null ? null : rows[row - 1]?.[column - 1] ?? null;

  const rDescription = rowOf("description");
  const rMindset = rowOf("mindset");
  const rAction = rowOf("action");
  const rBehaviour = rowOf("behaviour");
  const rObjective = rowOf("objective");
  const rSteps = rowOf("steps");
  const rLifecycle = rowOf("lifecycle");
  const rUpcoming = rowOf("upcoming");
  const rQuestions = rowOf("questions");
  const rTouchpoints = rowOf("touchpoints");
  const rRisks = rowOf("risks");
  const rIdeas = rowOf("ideas");
  const rChannels = rowOf("channels");
  const rKpis = rowOf("kpis");

  const stages: JourneyStage[] = stageCols.map((s, i) => {
    const nextColumn = stageCols[i + 1]?.column ?? width + 1;
    return {
      id: slug(s.name),
      name: s.name,
      column: s.column,
      span: nextColumn - s.column,
      description: cell(rDescription, s.column),
      mindset: cell(rMindset, s.column),
      action: cell(rAction, s.column),
      behaviour: cell(rBehaviour, s.column),
      objective: cell(rObjective, s.column),
      lifecycle: cell(rLifecycle, s.column),
      upcoming: cell(rUpcoming, s.column),
      questions: cell(rQuestions, s.column),
      touchpoints: cell(rTouchpoints, s.column),
      risks: cell(rRisks, s.column),
      ideas: cell(rIdeas, s.column),
      channels: cell(rChannels, s.column),
      kpis: cell(rKpis, s.column),
    };
  });

  // Every column that carries a step label, assigned to the stage it sits under.
  const steps: JourneyStep[] = [];
  if (rSteps) {
    for (let c = 2; c <= width; c++) {
      const label = cell(rSteps, c);
      if (!label) continue;
      const stage = [...stages].reverse().find((s) => s.column <= c);
      if (!stage) {
        issues.push({ severity: "warning", where: `column ${c}`, message: `Step "${label}" sits before the first stage and was left out.` });
        continue;
      }
      steps.push({ index: steps.length + 1, column: c, stageId: stage.id, label });
    }
  }
  if (!steps.length) issues.push({ severity: "error", where: JOURNEY_ROWS.steps, message: "No journey steps found; the row exists but every column is empty." });

  // The funnels the business asked for, one per line of the KPIsNeeded sheet.
  const funnels: JourneyFunnel[] = [];
  const funnelSheet = wb.getWorksheet(FUNNEL_SHEET);
  if (!funnelSheet) {
    issues.push({ severity: "warning", where: FUNNEL_SHEET, message: `No "${FUNNEL_SHEET}" sheet; the lifecycle funnels were not imported.` });
  } else {
    for (let r = 1; r <= funnelSheet.rowCount; r++) {
      const line = text(funnelSheet.getRow(r).getCell(1).value);
      if (!line || !line.includes("→")) continue;
      const [pathPart, ...rest] = line.split(":");
      const path = pathPart.split("→").map((p) => p.trim()).filter(Boolean);
      if (path.length < 2) continue;
      funnels.push({ id: slug(path.join("-")), path, note: rest.join(":").trim() });
    }
    if (!funnels.length) issues.push({ severity: "warning", where: FUNNEL_SHEET, message: "The sheet has no lines shaped like \"A → B → C: why it matters\"." });
  }

  return {
    version: 1,
    stages,
    steps,
    funnels,
    source: {
      fileName: meta.fileName,
      sheet: sheet.name,
      importedAt: new Date().toISOString(),
      importedBy: meta.importedBy,
      rowMap,
    },
    issues,
  };
}
