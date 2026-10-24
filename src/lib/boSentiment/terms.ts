// THE VOCABULARY, RE-SORTED - what changed from the workflow, and why.
//
// The workflow's words are kept (legacyTagged.ts); what changes is which bucket they count in
// and how much one of them is worth. Three decisions, each aimed at a defect the live numbers
// show rather than at a hunch:
//
// 1. URGENCY IS NOT DISSATISFACTION. "urgent" was listed six times in the negative-tone list,
//    so one polite "this is urgent for us" scored 6 against a threshold of 2 and the ticket came
//    out negative. A customer saying something is urgent is telling us about a DEADLINE, not
//    about how they feel. 22.1% of 31,577 Back-Office tickets came out negative, which is not
//    credible for an order desk, and urgency words are the main reason. They move to their own
//    dimension - which the Back Office actually wants to see - and stop driving tone.
//
// 2. CHASING IS ONLY MILDLY NEGATIVE. "still waiting", "relance", "sollecito", "keine Antwort"
//    mean the customer is waiting, which matters, but a second reminder is not a complaint. They
//    count at half weight, so a chased ticket slides toward negative without being branded one.
//
// 3. A COMPLAINT OUTWEIGHS A PLEASANTRY. "Reklamation" is strong evidence; "passt" is weak. The
//    workflow expressed this by repeating entries, which multiplied per occurrence and ran away.
//    Here weight is declared once per term, and an occurrence can count at most twice.
//
// Everything not named below keeps its bucket at weight 1. These lists are therefore the
// EXCEPTIONS and can be read in one sitting - which is the point, because this is the part a
// person will want to argue with.

import {
  RESOL_NEG_TAGGED, RESOL_POS_TAGGED, TONE_NEG_TAGGED, TONE_POS_TAGGED, type Lang, type TaggedTerm,
} from "./legacyTagged";

export type Dimension = "tone_pos" | "tone_neg" | "chasing" | "urgency" | "resol_pos" | "resol_neg";
export type Term = { term: string; lang: Lang; dim: Dimension; weight: number };

/** A deadline, not a mood. Reported on its own and never as negative tone. */
export const URGENCY = new Set([
  "urgent", "asap", "as soon as possible", "immediately", "right now",
  "dringend", "sofort", "umgehend",
  "tres urgent", "extremement urgent",
  "urgente", "urgentissimo", "molto urgente",
  "anticipare le date", "anticipare la consegna",
]);

/** The customer is waiting, or reminding us. Counted at half weight. */
export const CHASING = new Set([
  // EN
  "still waiting", "still no", "still missing", "no response", "no answer", "no reply",
  "where is", "once again", "third time", "overdue", "past due",
  "kindly remind", "kind reminder", "gentle reminder", "second reminder",
  // DE
  "immer noch warten", "immer noch keine", "immer noch nichts", "immer noch nicht",
  "schon wieder", "keine antwort", "keine ruckmeldung", "keine rueckmeldung", "warte seit",
  "erinnerung", "freundliche erinnerung", "letzte erinnerung", "untergegangen", "ist untergegangen",
  "frist abgelaufen", "frist uberschritten", "uberschritten", "ueberschritten",
  // FR
  "toujours pas", "toujours en attente", "j'attends toujours", "toujours sans reponse",
  "aucune reponse", "aucun retour", "pas de reponse", "relance", "deuxieme relance",
  "premiere relance", "n'ai pas eu", "pas eu de nouvelle", "sans nouvelles",
  "encore une fois", "ca traine", "ca devient long", "trop long", "delai depasse",
  "delai non respecte",
  // IT
  "ancora in attesa", "ancora nessuna", "ancora nessuna risposta", "nessuna risposta",
  "sollecito", "sollecitiamo", "ulteriore sollecito", "in attesa da giorni",
  "in attesa da settimane", "fermo da", "ennesima volta", "termine scaduto", "scadenza superata",
]);

/**
 * Terms dropped: too common, too ambiguous, or a word-sense accident that survives even
 * word-boundary matching. Each is named with its reason - a silent drop list rots.
 */
export const DROPPED: Record<string, string> = {
  // "our demand", "demand planning" - ordinary trade English; and the French "demande" (a quote
  // request) is what made this term notorious in the old scoring
  demand: "ordinary trade English; the French 'demande' means a request",
  // "please send it again" is a neutral request; the complaint forms are kept
  again: "neutral in 'please send again'; 'once again' and 'third time' are kept",
  // German for "why" - in a question-heavy inbox this fires on everything
  warum: "German 'why' - fires on ordinary questions",
  // "closed lost" is a CRM stage phrase that appears in our own close notes
  lost: "'closed lost' is a stage phrase in our own notes",
  // a stem, which word-boundary matching cannot match anyway
  escalat: "a stem; escalate / escalated / escalation are listed on their own",
};

/**
 * Terms the workflow put in BOTH buckets on the same side, found by comparing the lists rather
 * than by reading them: one occurrence scored +1 and -1 at once, so it has never contributed
 * anything to any ticket. Dropping them changes no figure and removes a trap.
 *
 * "weitergeleitet an" ("forwarded to") sits in the positive resolution list as progress and in
 * the negative one as a hand-off. Both readings are fair, which is exactly why the bare phrase
 * cannot decide anything: the sense lives in "info weitergeleitet" (progress) and
 * "eskaliert" / "transferred to" (hand-off), which are listed separately and are kept.
 */
export const AMBIGUOUS: Record<string, string> = {
  "weitergeleitet an": "in both resolution lists at once - progress and hand-off cancel out",
};

/** Unambiguous dissatisfaction, worth three. */
export const STRONG_NEG = new Set([
  "complaint", "complain", "complaining", "unacceptable", "not acceptable",
  "ridiculous", "unprofessional", "useless", "terrible", "poor service", "fed up",
  "escalate", "escalation", "escalated",
  "beschwerde", "reklamation", "inakzeptabel", "nicht akzeptabel", "unverschaemt",
  "frechheit", "skandal", "katastrophe", "unprofessionell", "eskalation", "anwalt",
  "geschaeftsfuehrung", "kuendigen",
  "plainte", "reclamation", "inacceptable", "scandaleux", "honteux", "intolerable",
  "deplorable", "lamentable", "ras le bol", "j'en ai marre", "c'est inadmissible",
  "je porte plainte", "je vais escalader", "tres mauvais service", "catastrophique",
  "reclamo", "reclamazione", "lamentela", "inaccettabile", "scandaloso", "vergognoso",
  "inammissibile", "perdita di tempo", "fermo produzione", "linea ferma",
]);

/** Explicit praise, worth two - so one clear "perfect" is enough on its own. */
export const STRONG_POS = new Set([
  "excellent", "perfect", "wonderful", "brilliant", "fantastic", "awesome",
  "great service", "great help", "really helpful", "very helpful",
  "exactly what i needed", "satisfied", "happy with",
  "perfekt", "wunderbar", "spitze", "klasse", "sehr zufrieden", "sehr hilfreich",
  "tolle arbeit", "top service",
  "parfait", "genial", "impeccable", "tres satisfait", "formidable", "tres apprecie",
  "tip top",
  "perfetto", "fantastico", "magnifico", "ottimo grazie", "molto gentile",
  "gentilissimo", "apprezzo molto", "siete stati di grande aiuto",
]);

/** Our own apology. Real, but an apology is not a failed resolution - half weight. */
export const APOLOGY = new Set([
  "sorry", "i'm sorry", "im sorry", "so sorry", "please forgive", "my mistake", "my fault",
  "i didn't see", "i did not see", "apologies", "our apologies", "apologise",
  "tut mir leid", "tut uns leid", "es tut mir leid", "entschuldigung", "entschuldige",
  "wir entschuldigen uns", "verzeihung", "verzeihen sie",
  "desole", "desolee", "je suis desole", "nous sommes desoles", "veuillez nous excuser",
  "toutes nos excuses",
  "mi scuso", "ci scusiamo", "scusate", "scusami", "le nostre scuse",
  "ci dispiace", "siamo spiacenti",
]);

function build(tagged: readonly TaggedTerm[], home: Dimension): Term[] {
  const out: Term[] = [];
  for (const t of tagged) {
    if (DROPPED[t.term] || AMBIGUOUS[t.term]) continue;
    let dim = home;
    let weight = 1;
    if (home === "tone_neg") {
      if (URGENCY.has(t.term)) dim = "urgency";
      else if (CHASING.has(t.term)) { dim = "chasing"; weight = 0.5; }
      else if (STRONG_NEG.has(t.term)) weight = 3;
    } else if (home === "tone_pos") {
      if (STRONG_POS.has(t.term)) weight = 2;
    } else if (home === "resol_neg") {
      if (APOLOGY.has(t.term)) weight = 0.5;
    }
    out.push({ term: t.term, lang: t.lang, dim, weight });
  }
  return out;
}

/** The whole vocabulary, one entry per (language, term). */
export const VOCABULARY: readonly Term[] = [
  ...build(TONE_POS_TAGGED, "tone_pos"),
  ...build(TONE_NEG_TAGGED, "tone_neg"),
  ...build(RESOL_POS_TAGGED, "resol_pos"),
  ...build(RESOL_NEG_TAGGED, "resol_neg"),
];

/** Every term the override sets name - for the drift guard: a name matching nothing is dead config. */
export const OVERRIDE_TERMS: string[] = [
  ...URGENCY, ...CHASING, ...STRONG_NEG, ...STRONG_POS, ...APOLOGY,
  ...Object.keys(DROPPED), ...Object.keys(AMBIGUOUS),
];

export type { Lang };
