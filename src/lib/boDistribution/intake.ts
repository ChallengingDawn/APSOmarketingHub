// THE WAY IN - "SARCLA | Back Office Ticket Created | Notification" (2322831592) in the hub (SARCLA 05.11.2026: "This is
// the one we need to migrate"). Pure, for the tests and the compare.
//
// The workflow, on every ticket that enters Back Office "New" (once - no re-enrolment), as it ran:
//   CREATED BY THE BACK OFFICE (Adriana, Sara, Claudia, Leart, Vanessa, Rose, Ayla - and not already in Certificates):
//     a certificate request (category "Certificates (ONLY FOR BO)") -> as "created by hand" below;
//     anything else = a mail to the customer or an A+P team: subject "BO | MAIL TO CUSTOMER or A+P TEAMS", stage
//     Assigned, owner = the owner of the ticket's e-mail. No mail.
//   A FORM: only the mail to the Backoffice Team (the form's own workflow wrote subject and owner).
//   AN E-MAIL: the sender says which A+P team (finance, AVOR, CAD, the country units ...): "BO | EMAIL | <team> |
//     <e-mail subject> |"; any other sender: "BO | <requirement> <category> <channel> | <e-mail subject> | ". Then
//     requester = the owner, owner = Backoffice Team, the mail.
//   CREATED BY HAND (or anything else): a certificate named -> requester = the owner (the certificates process takes it
//     from there); else "BO | <requirement> <category> | <owner's name> ", requester = the owner, owner = Backoffice
//     Team, the mail.
//   The mail: "❗Back Office Ticket Created" to the Backoffice Team, with the ticket's information.
// Owner = Backoffice Team is what hands the ticket to the distribution: it gives a ticket only to the queue (actBo).

export const CREATED_WORKFLOW = { id: "2322831592", name: "SARCLA | Back Office Ticket Created | Notification" } as const;
export const BO_TEAM = "76164822";
/** "CREATED BY BO": the HubSpot users of the workflow's first branch */
export const BO_CREATORS: readonly string[] = ["76134415", "30050251", "76134337", "59393439", "76134388", "31935670", "59853572"];
export const STAGE_NEW = "2338266325";
export const STAGE_ASSIGNED = "2338266326";
export const STAGE_CERTIFICATES = "3640065212";
export const CERT_CATEGORY = "Certificates (ONLY FOR BO)";
export const MAIL_SUBJECT = "❗Back Office Ticket Created";

/** The sender -> the team in the subject, in the workflow's order (the first that matches wins). */
export const TEAMS: readonly { team: string; from: readonly string[] }[] = [
  { team: "FINANCE M100", from: ["aleksandra.wyrwich@angst-pfister.com", "finance@angst-pfister.com", "debitoren-apso@angst-pfister.com", "ersin.ucer@angst-pfister.com"] },
  { team: "FINANCE M110", from: ["accounting.de@apsoparts.com", "aleyna.guendogan@angst-pfister.com"] },
  { team: "CAD TEAM", from: ["pdm_auswertung@angst-pfister.com"] },
  { team: "FFKM TEAM", from: ["philippe.oetiker@angst-pfister.com", "ffkm@angst-pfister.com", "ralf.werder@angst-pfister.com"] },
  { team: "RECEPTION/ADMIN", from: ["ch@angst-pfister.com", "katharina.spuehler@angst-pfister.com"] },
  { team: "AVOR", from: ["avor@angst-pfister.com"] },
  { team: "LVS", from: ["lvs@angst-pfister.com"] },
  { team: "PFAS", from: ["pfas@angst-pfister.com"] },
  { team: "EDA", from: ["eda.apch@angst-pfister.com"] },
  { team: "IMPORT/EXPORT", from: ["import.export@angst-pfister.com"] },
  { team: "PERFORMIS", from: ["performis@angst-pfister.com"] },
  { team: "CUSTOMS", from: ["customs@angst-pfister.com"] },
  { team: "PROJECT INBOX A+P", from: ["project.apch@angst-pfister.com"] },
  // the speed boats, each its own
  { team: "DT SPEED BOAT", from: ["dt.apz.apch@angst-pfister.com"] },
  { team: "FT SPEED BOAT", from: ["ft.apz.apch@angst-pfister.com"] },
  { team: "AT SPEED BOAT", from: ["at.apz.apch@angst-pfister.com", "sales-at@angst-pfister.com"] },
  { team: "ST SPEED BOAT", from: ["st.apz.apch@angst-pfister.com"] },
  { team: "APG OR APFR", from: ["internalsales.apg@angst-pfister.com", "christian.michaud@angst-pfister.com", "rose-marie.rasteiro@angst-pfister.com", "paulo.graca@angst-pfister.com", "nathalie.valente@angst-pfister.com"] },
  { team: "APZ", from: ["internalsales.apch@angst-pfister.com"] },
  // the country units
  { team: "APDE", from: ["_apd._apd@angst-pfister.com"] },
  { team: "APNL", from: ["r.box.apnl@angst-pfister.com"] },
  { team: "APIT", from: ["apittp@angst-pfister.com"] },
  { team: "ASSIWELL", from: ["assiwell@angst-pfister.com"] },
  { team: "SUSTAINABILITY", from: ["sustainability@angst-pfister.com"] },
  { team: "SENSORS & POWER CH", from: ["sensorsandpower@angst-pfister.com"] },
  { team: "SENSORS & POWER DE", from: ["sensorsandpower.de@angst-pfister.com"] },
];
export function teamOf(from: string | null | undefined, teams: readonly { team: string; from: readonly string[] }[] = TEAMS): string | null {
  const f = (from ?? "").trim().toLowerCase();
  if (!f) return null;
  return teams.find((t) => t.from.includes(f))?.team ?? null;
}
/** What Back Office distribution > Way in changes: the sender -> team list, the Back Office's own people. */
export type IntakeConfig = { teams: readonly { team: string; from: readonly string[] }[]; creators: readonly string[] };
export const WORKFLOW_CONFIG: IntakeConfig = { teams: TEAMS, creators: BO_CREATORS };

/** "Original source" (hs_originating_generic_channel_id) as a workflow token prints it */
const CHANNEL: Record<string, string> = { "1000": "Chat", "1002": "Email", "1003": "Form", "1004": "Facebook Messenger", "1005": "Calling", "1007": "WhatsApp" };
export const channelLabel = (v: string | null | undefined) => (v ? CHANNEL[v] ?? v : "");

export type IntakeFacts = {
  /** hs_created_by_user_id */
  createdBy: string | null;
  stage: string | null;
  category: string | null;
  /** which_certificate__ as stored ("FDA;OTHERS"), null = none */
  certs: string | null;
  /** source_type: EMAIL, FORM, CHAT ... */
  sourceType: string | null;
  requirement: string | null;
  channel: string | null;
  owner: string | null;
  ownerName: string | null;
  /** the ticket's e-mail the workflow read: the most recently modified one */
  email: { from: string | null; subject: string | null; owner: string | null } | null;
};
export type IntakeBranch = "MAIL TO CUSTOMER" | "FORM" | "EMAIL TEAM" | "EMAIL" | "CERTIFICATE" | "BY HAND";
export type Intake = { branch: IntakeBranch; team: string | null; props: Record<string, string>; mail: boolean };

const tok = (v: string | null | undefined) => v ?? "";
const requester = (f: IntakeFacts): Record<string, string> => (f.owner ? { back_office_ticket_requester: f.owner } : {});

function byHand(f: IntakeFacts): Intake {
  if ((f.certs ?? "").trim()) return { branch: "CERTIFICATE", team: null, props: requester(f), mail: false };
  return {
    branch: "BY HAND", team: null, mail: true,
    props: { subject: `BO | ${tok(f.requirement)} ${tok(f.category)} | ${tok(f.ownerName)} `, ...requester(f), hubspot_owner_id: BO_TEAM },
  };
}

/** What the workflow writes on a ticket that entered Back Office "New" (with the way in's lists). */
export function intakeOf(f: IntakeFacts, cfg: IntakeConfig = WORKFLOW_CONFIG): Intake {
  if (f.createdBy && cfg.creators.includes(f.createdBy) && f.stage !== STAGE_CERTIFICATES) {
    if (f.category === CERT_CATEGORY) return byHand(f);
    return {
      branch: "MAIL TO CUSTOMER", team: null, mail: false,
      props: { subject: "BO | MAIL TO CUSTOMER or A+P TEAMS", hs_pipeline_stage: STAGE_ASSIGNED, ...(f.email?.owner ? { hubspot_owner_id: f.email.owner } : {}) },
    };
  }
  if (f.sourceType === "FORM") return { branch: "FORM", team: null, props: {}, mail: true };
  if (f.sourceType === "EMAIL") {
    const team = teamOf(f.email?.from, cfg.teams);
    const es = tok(f.email?.subject);
    const subject = team ? `BO | EMAIL | ${team} | ${es} |` : `BO | ${tok(f.requirement)} ${tok(f.category)} ${channelLabel(f.channel)} | ${es} | `;
    return { branch: team ? "EMAIL TEAM" : "EMAIL", team, mail: true, props: { subject, ...requester(f), hubspot_owner_id: BO_TEAM } };
  }
  return byHand(f);
}
