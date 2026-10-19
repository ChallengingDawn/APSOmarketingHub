// THE STAGES AS SHOWN, where they differ from the catalogue's - catalogue.ts is generated from SARCLA's
// workbook and never edited by hand, so a rename, a move or a stage left out lives here.
//   lead      "Lead (by team and country on SL)" -> "Lead Generation" (SARCLA 18.10.2026)
//   cart      -> "UC hand-overs" on /uc: what the UC workflows hand over to ESO and TSA (SARCLA 19.10.2026:
//             "the UC hand-overs would replace completely the cart & checkout - this is a UC"); Hand-over
//             to ESO/TSA keeps the customers' requests only
//   purchase  not shown (SARCLA 19.10.2026: "purchase disappears completely" - its ROAS is on Reach)
//   order     Reach first; Who are our customers just before Retain & grow (SARCLA 19.10.2026)

import { STAGES, type KpiStage } from "./catalogue";

const NAMES: Record<string, string> = { lead: "Lead Generation", uc: "UC hand-overs" };
/** the catalogue's slug -> the page's, where the page took another stage's place */
const MOVED: Record<string, string> = { cart: "uc" };
// Efficiency & targets is gone (SARCLA 20.10.2026: "completely gone") - its targets stay on SMEC targets and Monthly inputs
const ORDER = ["reach", "visit", "engage", "lead", "handover", "uc", "customers", "retain"];

/** The page's name as shown: the rename when there is one, else the catalogue's without its "(...)". */
export function stageName(slug: string, catalogueName: string): string {
  return NAMES[slug] ?? catalogueName.replace(/\s*\(.*\)\s*$/, "");
}

/** The stages in the order the side panel and In a nutshell show them; the catalogue's id stays. */
export const SHOWN_STAGES: KpiStage[] = ORDER.flatMap((slug) => {
  const s = STAGES.find((x) => (MOVED[x.slug] ?? x.slug) === slug);
  return s ? [{ ...s, slug }] : [];
});

/** A page's stage by its slug, as shown - undefined for one that is not (Purchase, the old Cart, Efficiency). */
export const shownStage = (slug: string): KpiStage | undefined => SHOWN_STAGES.find((s) => s.slug === slug);
