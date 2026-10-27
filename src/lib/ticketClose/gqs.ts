// TASK STATUS REPORTS LEFT IN BACK OFFICE - into their GQS task (SARCLA 27.10.2026: '"Task Status Report" should be GQS to
// merge'; chose "merge where found, the rest stay"). Routing step #50 merges a report into the GQS task of its O number
// three minutes after it arrives; the ones that stay in Back Office carry no O number #50 can read (or a broken one:
// "O25.610841", "O25.02.10"). Dry run 27.10 over all 241: 5 found by O number, 23 by a reference number that finds
// exactly ONE GQS task (the customer number - "711297 Wago-Contact SA" in both), 26 ambiguous, 187 nothing. A merge
// cannot be undone, so: only an exact O number or a reference with exactly one GQS task; never several; the GQS task's
// stage and owner are left as they are (the history is mostly closed); every merge is kept in kv ticketClose:gqsMerges.
// Pure parts here, the HubSpot calls in the engine.

/** A Task Status Report e-mail, whatever came before it in the subject ("BO | Email | Task Status Report: ..."). */
export const isTsr = (subject: string | null | undefined) => /task status report/i.test(subject ?? "");

/** The O number #50 reads (O2x.xxxxxxxx), upper-cased. */
export const oOf = (subject: string | null | undefined): string | null => (subject?.match(/O2\d\.\d{8}/i) ?? [])[0]?.toUpperCase() ?? null;

/** Reference numbers in the subject: 6 to 10 digits, not part of an A/B/O order number. */
export function refsOf(subject: string | null | undefined): string[] {
  const s = String(subject ?? "").replace(/[AOB]2\d\.[\d.]{4,}/gi, " ");
  return [...new Set(s.match(/\b\d{6,10}\b/g) ?? [])];
}

/** The note the GQS task gets when a report is merged into it. */
export const mergedNote = (boId: string, how: "O" | "ref", key: string, subject: string) => [
  "📋 TASK STATUS REPORT MERGED", "",
  `A Task Status Report that had stayed in Back Office (ticket ${boId}) was merged into this GQS task,`,
  how === "O" ? `found by its O number ${key}.` : `found by the reference ${key} - the only GQS task with it.`,
  "", `Subject: ${subject.slice(0, 200)}`, "", "Stage and owner of this task were left as they were.",
  "", "---", "APSOhub (Back Office: Task Status Reports into GQS)",
].join("\n");
