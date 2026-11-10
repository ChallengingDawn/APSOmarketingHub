// APSOconvert > IS IT ENGLISH? (SARCLA 10.11.2026: "still text in German" - optimizations the AI wrote before the rule
// "everything in English" kept their German; "the recommendations should always be in English"). The shop's other
// languages read by their small words: a text with more of German's, French's, Italian's, Dutch's or Polish's little
// words than English's is not English. A shop label quoted inside an English sentence ("Filter anzeigen") stays English.
//
// Pure (no "@/" imports), so it is tested.

const EN = new Set([
  "the", "and", "of", "to", "in", "is", "for", "on", "with", "a", "an", "it", "this", "that", "are", "from", "by", "at",
  "as", "or", "be", "more", "fewer", "their", "they", "its", "not", "no", "what", "which", "who", "page", "buyers", "into",
  "than", "there", "has", "have", "can", "should", "would", "each", "every", "one", "where", "when", "under", "above",
]);

const OTHER = new Set([
  // German
  "der", "die", "das", "und", "ist", "nicht", "mit", "für", "von", "auf", "den", "dem", "ein", "eine", "einen", "einem",
  "einer", "zu", "zum", "zur", "im", "sind", "oder", "auch", "wird", "werden", "als", "bei", "aus", "nur", "noch",
  "diese", "dieser", "dieses", "sich", "wie", "sie", "nach", "über", "mehr", "weniger", "damit", "jede", "jeder", "fast",
  "gehen", "seite", "kunden", "einfügen", "verlinkt", "benötigt",
  // French
  "le", "la", "les", "et", "est", "pour", "avec", "une", "du", "dans", "sur", "pas", "plus", "sont", "cette", "qui",
  "que", "aux", "au", "sans", "leur", "nous", "vous",
  // Italian
  "il", "che", "di", "della", "delle", "dei", "con", "non", "sono", "questa", "questo", "gli", "nella", "alla", "allo",
  "degli", "anche", "più",
  // Dutch
  "het", "een", "van", "voor", "niet", "met", "zijn", "deze", "wordt", "naar", "ook", "worden",
  // Polish
  "przez", "dla", "nie", "jest", "się", "oraz", "jak", "jako", "lub",
]);

/** How many of English's small words a text has, and how many of the shop's other languages'. */
export function languageScore(text: string): { en: number; other: number } {
  const words = String(text ?? "").toLowerCase().match(/\p{L}+/gu) ?? [];
  let en = 0, other = 0;
  for (const w of words) {
    if (EN.has(w)) en++;
    else if (OTHER.has(w)) other++;
  }
  return { en, other };
}

/** Reads as English: no small word of another language, or more English ones than theirs (a quoted shop label). */
export function looksEnglish(text: string): boolean {
  const { en, other } = languageScore(text);
  if (other === 0) return true;
  if (en === 0) return false;
  return !(other >= 2 && other > en);
}
