// CERTIFICATES - the rule (SARCLA 04.11.2026: "I've turned off by mistake SARCLA | CERTIFICATES NEW PROCESS ... migrate
// ASAP this certificates process to the hub as a sub-app, follow the logic"). Pure, for the tests.
//
// The HubSpot workflow 2959551709 (on since 01.11.2025, switched off 04.11.2026 23:13) on the Back Office tickets that
// ask for a certificate, as it ran:
//   START   a certificate ticket created by the Back Office (the workflow "Back Office Ticket Created | Notification"
//           enrolled it): EC 1935/2004 among the certificates -> AVOR (a new article number is needed first), else
//           -> BACK OFFICE.
//   AVOR    stage Certificates, owner = the ticket's requester, "Actions for certificates" = New article number for
//           1935 - AVOR. Not answered: 48 h, 96 h, then "over a week" in the subject, then 15 days later the owner
//           becomes Rose Rasteiro with a note "handle it manually".
//   BACK OFFICE  ("Article received" set, or straight from START): stage Certificates, owner = the next of the Back
//           Office rotation; three days before the delivery date at 07:00: "3 days for delivery - create the
//           certificate" in the subject and stage Remind Back Office (the workflow "Back Office Ticket Remind" mails
//           the owner from there).
//   EXPERT  ("Assign to Conformity Expert" set): stage Certificates, the conformity expert = the next of the experts'
//           rotation and owner. On the delivery date at 05:00 "delivery date is today" and stage Remind; not sent 48 h
//           later (or the date already past): "Certificate is late", 48 h: "96 hours yet not sent", 48 h: "over a week
//           yet not sent", 15 days: owner Rose Rasteiro with the note.
//   SENT    ("Sent out to customer and EDA" set while with the expert): the plain subject, stage Resolved.
//   MERGED  a certificate ticket merged into another: "Actions for certificates" emptied, then the three-days step.
//
// Put right, not copied (listed on the page): the 96 h AVOR subject named the certificates twice; the AVOR path's last
// wait sent the ticket to Rose even when the article came; the expert's last wait waited for "Article received" in
// place of "Sent out"; a merged ticket lost a later "Assign" (the MERGED branch caught every re-enrolment); "Sent out"
// before the delivery date was missed and the ticket called late.
//
// Times are Swiss time, as the workflow's. Every step has the moment it falls due: what fell due before the workflow
// was switched off was the workflow's (WORKFLOW_OFF_AT) - the hub takes every step after, so the 25 tickets enrolled
// that evening go on where they stood.
//
// THE BACK OFFICE'S REMINDERS (SARCLA 05.11.2026: "we need to migrate the rest of certificates, stay with the first
// SARCLA | Back Office Ticket Created | Notification"). The workflow "Back Office Ticket Remind | Notification"
// (2322872555) took a certificate ticket when it went to stage Remind Back Office (the 3-days step): it mailed the
// owner "3 days for certificate delivery", then, while nobody chose "Assign to Conformity Expert": 72 h -> "CERTIFICATE
// DUE TODAY", 48 h -> "48 HOURS AGO", 48 h -> "96 HOURS AGO", 48 h -> "MORE THAN ONE WEEK" (subject and a mail to the
// owner each), 15 days -> owner Rose Rasteiro and a mail to her. The hub does it from the moment that workflow no longer
// takes certificate tickets ("which certificate is unknown" in its trigger, its certificates branch gone, or switched
// off) - until then the hub sets the stage and that workflow mails, as before. Put right: the reminders come on the
// delivery date (07:00) and after it, not 72 h after the ticket went to Remind; the expert no longer gets the Back
// Office's reminders (the expert's own "today"/"late" steps put the ticket back in Remind, and that workflow ran its
// Back Office chain on it again, writing over the expert's subjects); the last mails said "96 hours ago".

/** 04.11.2026 23:13:33 Swiss time - from this moment the process is the hub's (HubSpot's 2959551709 switched off) */
export const WORKFLOW_OFF_AT = Date.parse("2026-11-04T22:13:33Z");
// Only the hub from here on (SARCLA 07.11.2026: "take out all reference to workflow - I want to do it only via the
// hub"): the moments each part became the hub's are fixed, no workflow is read any more.
/** 05.11.2026 06:28:11 Swiss - the Back Office's certificate reminders (Remind's certificates branch, revision 76) */
export const REMIND_OFF_AT = Date.parse("2026-11-05T05:28:11Z");
/** 05.11.2026 07:15:07 Swiss - the reminder on every other ticket in Remind (Remind switched off, revision 77) */
export const OTHERS_OFF_AT = Date.parse("2026-11-05T06:15:07.500Z");
export const BO_PIPELINE = "1726786777";
export const STAGE = { new: "2338266325", remind: "2338266327", certificates: "3640065212", resolved: "2338266328" } as const;
export const ACT = {
  avor: "New article number for 1935 - AVOR",
  article: "Article received and order changed",
  expert: "Assign to Confirmity Expert",
  sent: "Sent out to customer and EDA",
} as const;
/** as HubSpot shows them */
export const ACT_LABEL: Record<string, string> = {
  [ACT.avor]: "New article number for 1935 - AVOR", [ACT.article]: "Article received or FT/DT article",
  [ACT.expert]: "Assign to Conformity Expert", [ACT.sent]: "Sent out to customer and EDA",
};
export const CATEGORY = "Certificates (ONLY FOR BO)";
export const EC1935 = "EC 1935/2004";
/** the order HubSpot lists them in */
const CERT_ORDER = ["FDA", "EC 1935/2004", "OTHERS"];

export type People = { backOffice: string[]; experts: string[]; escalation: string };
/** The workflow's: Back Office rotation Sara Gashi, Claudio Gabinato (Adriana Deblander and Vanessa Battaglia left);
 *  conformity experts Maida Osmani, Claudia Cagnoni; after 15 days Rose Rasteiro. Owner ids. */
export const DEFAULT_PEOPLE: People = { backOffice: ["30050251", "1229976030"], experts: ["1207485931", "76134337"], escalation: "31935670" };

export const H = 3600_000;
export const D = 24 * H;

/**
 * The times and waits - the workflows' by default, changed on the console (SARCLA 05.11.2026, "timings editable").
 * The subjects keep the workflows' words ("48 hours", "more than one week") whatever the waits.
 */
export type Timing = {
  /** hour (Swiss) of "3 days for delivery" and of the Back Office's reminders */
  boHour: number;
  /** days before the delivery date for "create the certificate" */
  boDaysBefore: number;
  /** hours between the Back Office's reminders after the delivery date */
  boEveryH: number;
  /** hour (Swiss) of "delivery date is today" for the expert */
  expertHour: number;
  /** hours between the expert's "late" steps */
  lateEveryH: number;
  /** hours between the reminders to AVOR */
  avorEveryH: number;
  /** days after the last reminder before the ticket goes to the hand-over person */
  escalationDays: number;
};
export const DEFAULT_TIMING: Timing = { boHour: 7, boDaysBefore: 3, boEveryH: 48, expertHour: 5, lateEveryH: 48, avorEveryH: 48, escalationDays: 15 };
/** The bounds the console accepts - null = fine. */
export const TIMING_BOUNDS: Record<keyof Timing, [number, number]> = {
  boHour: [0, 23], boDaysBefore: [0, 14], boEveryH: [4, 240], expertHour: [0, 23], lateEveryH: [4, 240], avorEveryH: [4, 240], escalationDays: [1, 60],
};
export function timingProblem(t: Partial<Timing>): string | null {
  for (const [k, v] of Object.entries(t)) {
    const b = TIMING_BOUNDS[k as keyof Timing];
    if (!b) return `unknown: ${k}`;
    if (typeof v !== "number" || !Number.isInteger(v) || v < b[0] || v > b[1]) return `${k}: a whole number from ${b[0]} to ${b[1]}`;
  }
  return null;
}

/** What the hub reads of a ticket. Times in ms. */
export type Facts = {
  id: string;
  stage: string | null;
  actions: string | null;
  /** the last change of "Actions for certificates" and who made it (sourceType) */
  actionsAt: number | null;
  actionsBy: string | null;
  /** the value before the last change */
  actionsBefore: string | null;
  certs: string[];
  other: string | null;
  mandant: string | null;
  order: string | null;
  /** delivery date for certificate, YYYY-MM-DD; dueAt = when it was last written (ms) */
  due: string | null;
  dueAt?: number | null;
  company: string | null;
  owner: string | null;
  requester: string | null;
  expert: string | null;
  category: string | null;
  createdAt: number;
  /** the last merge into this ticket */
  mergedAt: number | null;
  /** the first entry into stage Certificates - the process had started it */
  startedAt: number | null;
  subject: string | null;
  /** sarcla_article_number_order_pm - for the mail */
  articles?: string | null;
  /** the last entry into stage Remind Back Office */
  remindAt?: number | null;
};

export type Phase = "start" | "avor" | "backOffice" | "expert" | "sent" | "merged";
/** One write. `rotate` takes the next of a rotation into the field. */
export type Act =
  | { kind: "set"; prop: string; value: string }
  | { kind: "subject"; head: string }
  | { kind: "rotate"; who: "backOffice" | "experts"; prop: "hubspot_owner_id" | "conformity_expert"; alsoOwner?: boolean }
  | { kind: "ownerFrom"; prop: "back_office_ticket_requester" }
  | { kind: "escalate" }
  /** a mail to the ticket's owner (after the step's writes) - only once the Remind workflow no longer takes certificate tickets */
  | { kind: "mail"; mail: MailName };
/** remind = the Remind workflow's own step: the hub's only from the switch-over (REMIND_WORKFLOW_ID) */
export type Step = { key: string; name: StepName; at: number; acts: Act[]; remind?: true };
export type StepName =
  | "start-avor" | "start-bo" | "avor48" | "avor96" | "avorWeek" | "avorRose"
  | "bo-entry" | "bo3days" | "boToday" | "bo48" | "bo96" | "boWeek" | "boRose"
  | "expert-entry" | "today" | "late" | "late96" | "lateWeek" | "lateRose" | "close" | "merge-clear"
  /** the way in's part for a certificate ticket (Back Office Ticket Created): requester = who created it */
  | "wayin";
export type MailName = "bo3days" | "boToday" | "bo48" | "bo96" | "boWeek" | "boRose";

export const HEAD = {
  std: "CERTIFICATES",
  avor48: "⚠️ 48 hours no new article - please remind AVOR - CERTIFICATES",
  avor96: "⚠️ 96 hours no new article - please remind AVOR - CERTIFICATES",
  avorWeek: "⚠️OVER A WEEK ⚠️ - please remind AVOR - CERTIFICATES",
  bo3days: "⚠️ 3 days for delivery - create the certificate",
  today: "⚠️ Certificate delivery date is today ! - CERTIFICATES",
  late: "⚠️ Certificate is late - CERTIFICATES",
  late96: "⚠️ 96 hours yet not sent - CERTIFICATES",
  lateWeek: "⚠️OVER A WEEK YET NOT SENT ⚠️ - CERTIFICATES",
  // the Remind workflow's
  boToday: "⚠️ CERTIFICATE DUE TODAY",
  bo48: "⚠️ CERTIFICATE DUE DATE WAS 48 HOURS AGO",
  bo96: "⚠️ CERTIFICATE DUE DATE WAS 96 HOURS AGO",
  boWeek: "⚠️ CERTIFICATE DUE DATE IS MORE THAN ONE WEEK",
} as const;

const ASK = 'Once created and attached to the ticket, please choose "Assign to Conformity Expert".';
/** The mails, as the Remind workflow wrote them: the first line, then what to do. */
export const MAIL_TEXT: Record<MailName, { line: string; ask: string }> = {
  bo3days: { line: "⚠️ 3 days for certificate delivery - please create it", ask: ASK },
  boToday: { line: "⚠️ CERTIFICATE DUE DATE IS TODAY - please create it", ask: ASK },
  bo48: { line: "⚠️ CERTIFICATE DUE DATE WAS 48 HOURS AGO - please create it", ask: ASK },
  bo96: { line: "⚠️ CERTIFICATE DUE DATE WAS 96 HOURS AGO - please create it", ask: ASK },
  boWeek: { line: "⚠️ CERTIFICATE DUE DATE IS MORE THAN ONE WEEK - please create it", ask: ASK },
  boRose: { line: "⚠️ CERTIFICATE DUE DATE IS MORE THAN ONE WEEK - the ticket is yours now", ask: "15 days more and still no certificate - please handle it manually." },
};

/** What each step does, in words - the page and the tests. */
export const STEP_WORDS: Record<StepName, string> = {
  "start-avor": "Started: EC 1935/2004 needs a new article number - stage Certificates, owner = the requester, action AVOR",
  "start-bo": "Started: stage Certificates, owner = next of the Back Office rotation",
  avor48: "48 h without the new article - remind AVOR (subject)",
  avor96: "96 h without the new article - remind AVOR (subject)",
  avorWeek: "Over a week without the new article (subject)",
  avorRose: "15 days more - owner Rose Rasteiro, note: handle it manually",
  "bo-entry": "Article received - stage Certificates, owner = next of the Back Office rotation",
  bo3days: "3 days before delivery, 07:00 - create the certificate (subject, stage Remind Back Office, mail to the owner)",
  boToday: "Delivery date, 07:00 - certificate due today (subject, mail to the owner)",
  bo48: "48 h after the delivery date, no certificate (subject, mail to the owner)",
  bo96: "96 h after the delivery date (subject, mail to the owner)",
  boWeek: "More than a week after the delivery date (subject, mail to the owner)",
  boRose: "15 days more - owner Rose Rasteiro, note and mail",
  "expert-entry": "Assigned to a conformity expert - next of the experts' rotation, also owner; stage Certificates",
  today: "Delivery date, 05:00 - delivery date is today (subject, stage Remind Back Office)",
  late: "Not sent - certificate is late (subject, stage Remind Back Office)",
  late96: "48 h later, not sent (subject)",
  lateWeek: "Over a week, not sent (subject)",
  lateRose: "15 days more - owner Rose Rasteiro, note: handle it manually",
  close: "Sent out to customer and EDA - plain subject, Resolved",
  "merge-clear": "Merged - Actions for certificates emptied",
  wayin: "Way in: requester = the owner who created it",
};

/** The steps the console switches on and off by group (SARCLA 06.11.2026: "develop more the console KPI and steering").
 *  A step of a group switched off is skipped - not taken later when the group is switched on again. The starts, the
 *  entries, Sent out and the merge always run. */
export type StepGroup = "avor" | "bo" | "expert" | "handover";
export const STEP_GROUP: Partial<Record<StepName, StepGroup>> = {
  avor48: "avor", avor96: "avor", avorWeek: "avor",
  bo3days: "bo", boToday: "bo", bo48: "bo", bo96: "bo", boWeek: "bo",
  today: "expert", late: "expert", late96: "expert", lateWeek: "expert",
  avorRose: "handover", boRose: "handover", lateRose: "handover",
};
export type StepSwitches = Record<StepGroup, boolean>;
export const DEFAULT_STEPS: StepSwitches = { avor: true, bo: true, expert: true, handover: true };

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const span = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} h`);
/** What each step does, with the console's times. */
export function stepWords(name: StepName, t: Timing = DEFAULT_TIMING): string {
  const w: Record<StepName, string> = {
    ...STEP_WORDS,
    avor48: `${span(t.avorEveryH)} without the new article - remind AVOR (subject)`,
    avor96: `${span(2 * t.avorEveryH)} without the new article - remind AVOR (subject)`,
    avorWeek: `${span(3 * t.avorEveryH)} without the new article - "over a week" (subject)`,
    avorRose: `${t.escalationDays} days more - the hand-over person, note: handle it manually`,
    bo3days: `${t.boDaysBefore} days before delivery, ${hh(t.boHour)} - create the certificate (subject, stage Remind Back Office, mail to the owner)`,
    boToday: `Delivery date, ${hh(t.boHour)} - certificate due today (subject, mail to the owner)`,
    bo48: `${span(t.boEveryH)} after the delivery date, no certificate (subject, mail to the owner)`,
    bo96: `${span(2 * t.boEveryH)} after the delivery date (subject, mail to the owner)`,
    boWeek: `${span(3 * t.boEveryH)} after - "more than a week" (subject, mail to the owner)`,
    boRose: `${t.escalationDays} days more - the hand-over person, note and mail`,
    today: `Delivery date, ${hh(t.expertHour)} - delivery date is today (subject, stage Remind Back Office)`,
    late: `Not sent ${span(t.lateEveryH)} after - certificate is late (subject, stage Remind Back Office)`,
    late96: `${span(t.lateEveryH)} later, not sent (subject)`,
    lateWeek: `${span(t.lateEveryH)} later again - "over a week" (subject)`,
    lateRose: `${t.escalationDays} days more - the hand-over person, note: handle it manually`,
  };
  return w[name];
}

// ---------------- the Remind workflow's trigger ----------------
/** A HubSpot filter branch, as the flows API gives it */
export type Branch = { filterBranchType?: string; filters?: { property?: string; operation?: { operator?: string } }[]; filterBranches?: Branch[] };
const isExclusion = (x: { property?: string; operation?: { operator?: string } }) => x.property === "which_certificate__" && /UNKNOWN|NOT_HAS/i.test(x.operation?.operator ?? "");
/** Does the trigger leave out every ticket that names a certificate? (an OR needs it in each of its branches) */
export function excludesCertificates(b: Branch | undefined): boolean {
  if (!b) return false;
  const all = [...(b.filters ?? []).map(isExclusion), ...(b.filterBranches ?? []).map(excludesCertificates)];
  return (b.filterBranchType ?? "AND") === "OR" ? all.length > 0 && all.every(Boolean) : all.some(Boolean);
}

// ---------------- Swiss time ----------------
const zoneFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
/** Europe/Zurich minus UTC at that moment, in ms */
function zoneOffset(ms: number): number {
  const p = Object.fromEntries(zoneFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
/** YYYY-MM-DD at hh:mm Swiss time, plus `days` */
export function swiss(date: string, hour: number, minute = 0, days = 0): number {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d + days, hour, minute);
  const first = guess - zoneOffset(guess);
  return guess - zoneOffset(first);
}
/** 24.11.26, as the workflow wrote the date */
export function dueShort(date: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

// ---------------- the subject ----------------
export function certsText(f: Pick<Facts, "certs" | "other">): string {
  const c = [...f.certs].sort((a, b) => (CERT_ORDER.indexOf(a) + 99) % 99 - (CERT_ORDER.indexOf(b) + 99) % 99).join(", ");
  return [c, f.other?.trim()].filter(Boolean).join(" ");
}
export function subjectOf(head: string, f: Facts): string {
  return `${head} | ${certsText(f)} | ${f.mandant ?? ""} | ${f.order ?? ""} | ${dueShort(f.due)} | ${f.company ?? ""} |`.replace(/\s+/g, " ").trim();
}

// ---------------- where a ticket stands ----------------
const isCert = (f: Facts) => f.certs.length > 0 || !!f.actions;

/** The phase the ticket is in and the moment it started (the anchor of its steps); null = not in the process. */
export function phaseOf(f: Facts): { phase: Phase; anchor: number } | null {
  if (f.stage === STAGE.resolved || !isCert(f)) return null;
  // a certificate ticket merged (list 7124) and nothing set since - an action set after the merge wins
  if (f.mergedAt !== null && (!f.actions || f.actionsBy === "MERGE_OBJECTS" || (f.actionsAt !== null && f.mergedAt >= f.actionsAt))) return { phase: "merged", anchor: f.mergedAt };
  if (f.actions === ACT.avor && f.actionsAt !== null) return { phase: "avor", anchor: f.actionsAt };
  if (f.actions === ACT.article && f.actionsAt !== null) return { phase: "backOffice", anchor: f.actionsAt };
  if (f.actions === ACT.expert && f.actionsAt !== null) return { phase: "expert", anchor: f.actionsAt };
  if (f.actions === ACT.sent && f.actionsAt !== null) return f.actionsBefore === ACT.expert ? { phase: "sent", anchor: f.actionsAt } : null;
  if (f.actions) return null;
  // no action yet: started by the process (it went to Certificates), or a new request to start
  if (f.startedAt !== null) return { phase: "backOffice", anchor: f.startedAt };
  if (f.certs.length && f.category === CATEGORY && f.stage !== STAGE.certificates) return { phase: "start", anchor: f.createdAt };
  return null;
}

const step = (phase: Phase, anchor: number, name: StepName, at: number, acts: Act[]): Step => ({ key: `${phase}@${new Date(anchor).toISOString()}:${name}`, name, at, acts });
const subj = (head: string): Act => ({ kind: "subject", head });
const mail = (m: MailName): Act => ({ kind: "mail", mail: m });
const remind = (s: Step): Step => ({ ...s, remind: true });
const stage = (s: string): Act => ({ kind: "set", prop: "hs_pipeline_stage", value: s });

/** Every step of the ticket's phase, in order, with the moment each falls due. */
export function stepsOf(f: Facts, t: Timing = DEFAULT_TIMING, settleMs = 2 * 60_000): { phase: Phase; anchor: number; steps: Step[] } | null {
  const p = phaseOf(f);
  if (!p) return null;
  const { phase, anchor: a } = p;
  const s: Step[] = [];
  if (phase === "start") {
    if (f.certs.includes(EC1935)) s.push(step(phase, a, "start-avor", a + settleMs, [stage(STAGE.certificates), subj(HEAD.std), { kind: "ownerFrom", prop: "back_office_ticket_requester" }, { kind: "set", prop: "actions_for_certificates", value: ACT.avor }]));
    else s.push(step(phase, a, "start-bo", a + settleMs, [stage(STAGE.certificates), subj(HEAD.std), { kind: "rotate", who: "backOffice", prop: "hubspot_owner_id" }]));
  } else if (phase === "avor") {
    s.push(step(phase, a, "avor48", a + t.avorEveryH * H, [subj(HEAD.avor48)]));
    s.push(step(phase, a, "avor96", a + 2 * t.avorEveryH * H, [subj(HEAD.avor96)]));
    s.push(step(phase, a, "avorWeek", a + 3 * t.avorEveryH * H, [subj(HEAD.avorWeek)]));
    s.push(step(phase, a, "avorRose", a + 3 * t.avorEveryH * H + t.escalationDays * D, [{ kind: "escalate" }]));
  } else if (phase === "backOffice" || phase === "merged") {
    if (phase === "merged") s.push(step(phase, a, "merge-clear", a, [{ kind: "set", prop: "actions_for_certificates", value: "" }]));
    else if (f.actions === ACT.article) s.push(step(phase, a, "bo-entry", a, [stage(STAGE.certificates), subj(HEAD.std), { kind: "rotate", who: "backOffice", prop: "hubspot_owner_id" }]));
    // no delivery date: the workflow stopped there
    if (f.due) {
      const t3 = Math.max(swiss(f.due, t.boHour, 0, -t.boDaysBefore), a);
      s.push(step(phase, a, "bo3days", t3, [subj(HEAD.bo3days), stage(STAGE.remind), mail("bo3days")]));
      // the Remind workflow's chain, on the delivery date (07:00) and after - never before the 3-days step
      const day = swiss(f.due, t.boHour);
      const e = t.boEveryH * H;
      const at = (x: number) => Math.max(x, t3);
      s.push(remind(step(phase, a, "boToday", at(day), [subj(HEAD.boToday), mail("boToday")])));
      s.push(remind(step(phase, a, "bo48", at(day + e), [subj(HEAD.bo48), mail("bo48")])));
      s.push(remind(step(phase, a, "bo96", at(day + 2 * e), [subj(HEAD.bo96), mail("bo96")])));
      s.push(remind(step(phase, a, "boWeek", at(day + 3 * e), [subj(HEAD.boWeek), mail("boWeek")])));
      s.push(remind(step(phase, a, "boRose", at(day + 3 * e + t.escalationDays * D), [{ kind: "escalate" }, subj(HEAD.boWeek), mail("boRose")])));
    }
  } else if (phase === "expert") {
    s.push(step(phase, a, "expert-entry", a, [stage(STAGE.certificates), { kind: "rotate", who: "experts", prop: "conformity_expert", alsoOwner: true }]));
    const day = f.due ? swiss(f.due, t.expertHour) : null;
    const e = t.lateEveryH * H;
    let late = a;
    if (day !== null && day > a) {
      s.push(step(phase, a, "today", day, [subj(HEAD.today), stage(STAGE.remind)]));
      late = day + e;
    }
    s.push(step(phase, a, "late", late, [subj(HEAD.late), stage(STAGE.remind)]));
    s.push(step(phase, a, "late96", late + e, [subj(HEAD.late96)]));
    s.push(step(phase, a, "lateWeek", late + 2 * e, [subj(HEAD.lateWeek)]));
    s.push(step(phase, a, "lateRose", late + 2 * e + t.escalationDays * D, [{ kind: "escalate" }]));
  } else if (phase === "sent") {
    s.push(step(phase, a, "close", a, [subj(HEAD.std), stage(STAGE.resolved)]));
  }
  return { phase, anchor: a, steps: s };
}

/**
 * What is owed now: the steps that fell due (at <= now), after the workflow was switched off (at >= offAt), and not
 * done yet. A step that fell due while the workflow ran was the workflow's. The Remind workflow's steps only from the
 * moment it no longer takes certificate tickets (remindOffAt; null = it still does - they stay HubSpot's).
 */
export function owed(f: Facts, done: Set<string>, now: number, offAt = WORKFLOW_OFF_AT, remindOffAt: number | null = null, t: Timing = DEFAULT_TIMING): Step[] {
  const p = stepsOf(f, t);
  if (!p) return [];
  return p.steps.filter((x) => x.at <= now && x.at >= offAt && !done.has(x.key) && (!x.remind || (remindOffAt !== null && x.at >= remindOffAt)));
}

/** The step the ticket is at (the last that fell due) and the next one, for the page. */
export function position(f: Facts, now: number, t: Timing = DEFAULT_TIMING): { phase: Phase; at: StepName | null; next: Step | null } | null {
  const p = stepsOf(f, t);
  if (!p) return null;
  const past = p.steps.filter((x) => x.at <= now);
  return { phase: p.phase, at: past.length ? past[past.length - 1].name : null, next: p.steps.find((x) => x.at > now) ?? null };
}

/**
 * The steps' writes as one PATCH, in order (a later subject wins), and the one mail to send (the last step's). Rotations
 * and the escalation are resolved by the caller. Mails only from the Remind switch-over (mailFrom; null = none - the
 * Remind workflow still mails).
 */
export function merge(
  f: Facts, steps: Step[], pick: (who: "backOffice" | "experts") => string | null, people: People, mailFrom: number | null = null,
): { props: Record<string, string>; note: boolean; mail: MailName | null } {
  const props: Record<string, string> = {};
  let note = false;
  let mailed: MailName | null = null;
  for (const st of steps) for (const a of st.acts) {
    if (a.kind === "set") props[a.prop] = a.value;
    else if (a.kind === "subject") props.subject = subjectOf(a.head, f);
    else if (a.kind === "rotate") {
      const id = pick(a.who);
      if (id) { props[a.prop] = id; if (a.prop === "hubspot_owner_id" || a.alsoOwner) props.hubspot_owner_id = id; }
    } else if (a.kind === "ownerFrom") {
      const id = f.requester ?? f.owner;
      if (id) props.hubspot_owner_id = id;
    } else if (a.kind === "escalate") {
      props.hubspot_owner_id = people.escalation;
      note = true;
    } else if (a.kind === "mail") {
      if (mailFrom !== null && st.at >= mailFrom) mailed = a.mail;
    }
  }
  return { props, note, mail: mailed };
}

// ---------------- the reminder on every other ticket in Remind ----------------
/** Who gets "⚠️REMINDER: Back Office Ticket" of one ticket (SARCLA 07.11.2026: "only mails directly to people - the
 *  reminder however should work"): its owner when that is a person, and the people picked as well; an owner who is not a
 *  person (the Backoffice Team, a queue) or none: the people picked, else the Back Office rotation. Once per address. */
export function reminderTo<R extends { email: string }>(owner: R | null, picked: R[], rotation: R[]): R[] {
  const out = owner ? [owner, ...picked] : picked.length ? picked : rotation;
  return out.filter((r, i) => out.findIndex((x) => x.email.toLowerCase() === r.email.toLowerCase()) === i);
}
