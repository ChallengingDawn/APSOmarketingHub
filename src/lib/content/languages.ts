// THE LANGUAGES A+P WRITES IN — one list, because two lists disagree.
//
// It lived inside Create Studio as a bare array of codes, which was enough
// for a dropdown and not enough for anything else: a translator needs to know
// what "DE" means, and it needs to know that an Angst+Pfister German text is
// Swiss German. "ß" in a Swiss catalogue reads as foreign, and the shop,
// the ERP and the printed matter all use "ss".

export type Language = {
  /** What the content rows store. Short, and already in the database. */
  code: string;
  /** What a person picks from a list. */
  label: string;
  /** What the model is told to write, including the house spelling. */
  instruction: string;
};

export const LANGUAGES: Language[] = [
  { code: "EN", label: "English", instruction: "English, British spelling (organisation, colour, metre)" },
  {
    code: "DE",
    label: "German",
    // The one rule nobody outside Switzerland applies by default.
    instruction: "German as written in Switzerland: no ß anywhere - use ss (Grösse, Verschluss, Massnahme)",
  },
  { code: "FR", label: "French", instruction: "French, as written for business in Switzerland and France" },
  { code: "IT", label: "Italian", instruction: "Italian, as written for business in Italy and Ticino" },
  { code: "NL", label: "Dutch", instruction: "Dutch, as written in the Netherlands" },
  { code: "PL", label: "Polish", instruction: "Polish" },
  { code: "ES", label: "Spanish", instruction: "Spanish, as written in Spain" },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export const LANGUAGE_BY_CODE: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

/** "IT" reads as a department on a card; "Italian" does not. */
export function languageLabel(code: string | null | undefined): string {
  if (!code) return "";
  return LANGUAGE_BY_CODE[code.toUpperCase()]?.label ?? code;
}

/**
 * What the new version is called.
 *
 * "Italian" on its own is enough when the source had no name; when it had
 * one, the name is the useful half and the language is the qualifier, because
 * a project can hold "Shorter hero" in four languages.
 */
export function translatedLabel(sourceLabel: string | null, targetCode: string): string {
  const lang = languageLabel(targetCode);
  const base = sourceLabel?.trim();
  if (!base) return lang;
  // Already a translation of a translation: do not stack the suffixes.
  const stripped = base.replace(/\s+–\s+[A-Za-z]+$/, "").trim() || base;
  return `${stripped} – ${lang}`;
}
