// The greeting rules, moved here from SARCLA C2S V1 (salutation.js) with the DoC app.
// Only what the declaration email needs: deciding a gender and the phrase for it.
//
// GENDER IS DEDUCED, NEVER GUESSED:
//   1. the salutation property (Male/Female) - the explicit gender field
//   2. otherwise the gender implied by a greeting someone already stored
//      ("Guten Tag Herr" on an "Other" contact is real evidence a human classified it)
//   3. otherwise the shop prefix (Mr/Mrs), last because it disagrees with an
//      explicit salutation on ~2% of contacts
//   4. otherwise neutral. Never from a first name: a wrong "Madame"/"Herr" in
//      business correspondence is a visible insult.

export type ContactProps = Record<string, string | null | undefined>;

// The phrase per language and gender, in the EXACT option values of the
// salutation_phrase property.
const MATRIX: Record<string, { Male: string; Female: string; neutral: string }> = {
  de: { Male: "Guten Tag Herr", Female: "Guten Tag Frau", neutral: "Guten Tag" },
  fr: { Male: "Bonjour Monsieur", Female: "Bonjour Madame", neutral: "Bonjour" },
  en: { Male: "Dear Mr.", Female: "Dear Ms.", neutral: "Dear" },
  it: { Male: "Buongiorno Signor", Female: "Buongiorno Signora", neutral: "Buongiorno" },
  nl: { Male: "Geachte heer", Female: "Geachte mevrouw", neutral: "Geachte heer/mevrouw" },
  // Polish direct address takes the vocative: "Dzień dobry Panie Kowalski".
  pl: { Male: "Dzień dobry Panie", Female: "Dzień dobry Pani", neutral: "Szanowni Państwo" },
};

// Every gendered phrase that may already be stored, in ANY language, including
// the legacy and ungrammatical values still present in the portal.
const PHRASE_GENDER: Record<string, "Male" | "Female"> = {
  "guten tag herr": "Male", "guten tag frau": "Female",
  "bonjour monsieur": "Male", "bonjour madame": "Female",
  "dear mr.": "Male", "dear mr": "Male", "dear ms.": "Female", "dear ms": "Female", "dear mrs.": "Female", "dear mrs": "Female",
  "buongiorno signor": "Male", "buongiorno signore": "Male", "buongiorno signora": "Female",
  "geachte heer": "Male", "geachte mevrouw": "Female",
  "dzień dobry panie": "Male", "dzień dobry pan": "Male", "szanowny panie": "Male",
  "dzień dobry pani": "Female", "szanowna pani": "Female",
};

// The shop's "Prefix" field (eyemagine_prefix), filled on ~71% of contacts.
const PREFIX_GENDER: Record<string, "Male" | "Female"> = {
  mr: "Male", "mr.": "Male", mister: "Male", herr: "Male", hr: "Male", monsieur: "Male", m: "Male", "m.": "Male",
  signor: "Male", sig: "Male", "sig.": "Male", dhr: "Male", "dhr.": "Male", heer: "Male", pan: "Male",
  mrs: "Female", "mrs.": "Female", ms: "Female", "ms.": "Female", miss: "Female", frau: "Female", fr: "Female",
  madame: "Female", mme: "Female", "mme.": "Female", mademoiselle: "Female", signora: "Female", "sig.ra": "Female",
  mevrouw: "Female", mevr: "Female", "mevr.": "Female", pani: "Female",
};

export function genderOf(props: ContactProps = {}): { gender: "Male" | "Female" | ""; source: string } {
  const g = String(props.salutation ?? "").trim();
  if (g === "Male" || g === "Female") return { gender: g, source: "salutation" };
  const implied = PHRASE_GENDER[String(props.salutation_phrase ?? "").trim().toLowerCase()];
  if (implied) return { gender: implied, source: "stored greeting" };
  const pfx = PREFIX_GENDER[String(props.eyemagine_prefix ?? "").trim().toLowerCase().replace(/\s+/g, "")];
  if (pfx) return { gender: pfx, source: "shop prefix" };
  return { gender: "", source: "unknown" };
}

/** The greeting phrase for this contact in `lang`, or "" for a language we do not handle. */
export function correctSalutation(props: ContactProps & { lang?: string }): string {
  const m = MATRIX[String(props.lang ?? props.hs_language ?? "").slice(0, 2).toLowerCase()];
  if (!m) return "";
  const { gender } = genderOf(props);
  return gender ? m[gender] : m.neutral;
}

/**
 * "lefebvre" / "LEFEBVRE" -> "Lefebvre" for the greeting, without touching the
 * stored record. Names already in mixed case are left alone.
 */
export function displayName(name: string | null | undefined): string {
  const s = String(name ?? "").trim();
  if (!s) return "";
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s
    .replace(/[\p{L}'’]+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .replace(/\b(Von|Van|De|Der|Den|Du|Di|Da|Le|La)\b(?=\s\p{Lu})/gu, (w) => w.toLowerCase());
}
