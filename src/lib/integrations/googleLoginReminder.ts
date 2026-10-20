// THE BORROWED GOOGLE LOGIN'S WEEKLY RENEWAL, BY MAIL (SARCLA 20.10.2026: "for the moment send an e-mail when I
// need to renew it"). Search Console is read through a person's Google login (googleUser.ts) until the hub's
// service account is a user on the property; Google ends such a login seven days after it was given - the
// Cloud project's sign-in is stuck in Testing, A+P has no Google Workspace (memory: project_hub_google_oauth).
// One mail the day before it ends, one when it has stopped - each once per login: the two servers both look,
// the database lets one of them send it. Read-only towards Google except the token refresh it already does.

import { ensureSchema } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { esc, mailConfigured, sendHubMail, wrap } from "@/lib/notify/mailer";
import { hubPublicUrl } from "@/lib/content/shareMail";
import { userAccessToken, userConnection } from "./googleUser";
import { GSC_SCOPE } from "./gsc";
import { LOGIN_LIFE_MS, reminderDue } from "./googleLoginDue";

/** Only one server sends a given mail: the first to write its key wins. */
async function claim(key: string): Promise<boolean> {
  await ensureSchema();
  const r = await query<{ k: string }>(
    `INSERT INTO apsomh_kv (k, v) VALUES ($1, $2::jsonb) ON CONFLICT (k) DO NOTHING RETURNING k`,
    [key, JSON.stringify({ at: new Date().toISOString() })],
  );
  return r.rows.length > 0;
}

const day = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export async function checkGoogleLogin(now = Date.now()): Promise<void> {
  if (!mailConfigured()) return;
  const c = await userConnection();
  if (!c) return; // nobody's login is borrowed - the service account reads, nothing to renew
  let stopped = false;
  try { await userAccessToken(GSC_SCOPE); } catch { stopped = true; }
  const due = reminderDue(c.connectedAt, now, stopped);
  if (!due) return;
  if (!(await claim(`google:renew-mail:${c.connectedAt}:${due}`))) return;
  const hub = hubPublicUrl();
  const ends = Date.parse(c.connectedAt) + LOGIN_LIFE_MS;
  const heading = due === "soon" ? `Renew the hub's Google login before ${day(ends)}` : "Search Console has stopped: the hub's Google login has ended";
  const intro = due === "soon"
    ? `The hub reads Search Console through the Google account ${c.email}. Google ends that login seven days after it was given - on ${day(ends)}. Connect it again and it runs for another seven days.`
    : `The hub read Search Console through the Google account ${c.email}, and Google has ended that login. Search Console's figures on the hub stop updating until it is connected again.`;
  const steps = [
    "Open the hub: Settings → Integrations.",
    "Disconnect, then \"Connect my Google account\" and sign in with " + c.email + ".",
    "That's all - the next read picks it up.",
  ];
  const rows = `<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
  const footer = "This reminder comes every week until the hub's own service account is a user on the Search Console property - then disconnect the login and it stops.";
  await sendHubMail({
    to: c.email,
    subject: heading,
    html: wrap({ heading, intro, rows, cta: { label: "Open Settings → Integrations", href: `${hub}/settings/integrations` }, hubUrl: hub, footer }),
    text: `${heading}\n\n${intro}\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n${hub}/settings/integrations\n\n${footer}`,
  });
  console.log(`[google-login] ${due === "soon" ? "renewal reminder" : "ended notice"} sent to ${c.email} (login given ${c.connectedAt})`);
}
