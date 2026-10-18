// THE NAMES THE PAGES ARE SHOWN UNDER where they differ from the catalogue's - catalogue.ts is
// generated from SARCLA's workbook and never edited by hand, so a rename lives here.
//   lead  "Lead (by team and country on SL)" -> "Lead Generation" (SARCLA 18.10.2026)

const NAMES: Record<string, string> = { lead: "Lead Generation" };

/** The page's name as shown: the rename when there is one, else the catalogue's without its "(...)". */
export function stageName(slug: string, catalogueName: string): string {
  return NAMES[slug] ?? catalogueName.replace(/\s*\(.*\)\s*$/, "");
}
