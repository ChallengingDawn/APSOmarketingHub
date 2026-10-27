// "SEND TO REVIEW" FROM THE SANDBOX, AS A MAIL TO THE REVIEWER (SARCLA 26.10.2026: "this should trigger me a mail via
// the hub so I can review what has been changed, with the sandbox link"). The sandbox cannot send mail - it holds no
// mail credentials - so the hub mails it on its round. To SANDBOX_REVIEW_TO; the change goes along as a .patch file.

import type { Review } from "@/lib/sandbox/link";
import { esc, sendHubMail, wrap } from "@/lib/notify/mailer";
import { hubPublicUrl } from "@/lib/content/shareMail";

const MAX_PATCH = 4 * 1024 * 1024;

/** `sandbox`: its name on the hub - the link opens it there, behind the hub's sign-in (its Railway address answers
 *  nobody but the hub, and a review's own text never chooses where the link goes). */
export function reviewMail(r: Review, sandbox: string, hubUrl: string) {
  const preview = `${hubUrl}/sandbox/run/${encodeURIComponent(sandbox)}`;
  const files = (Array.isArray(r.files) ? r.files : []).slice(0, 80);
  const fileRows = files.map((f) =>
    `<tr><td style="padding:3px 0;font:12px ui-monospace,Consolas,monospace;color:#15223a">${esc(String(f.path ?? ""))}</td>`
    + `<td style="padding:3px 0 3px 12px;font-size:12px;color:#1b7a55;text-align:right">+${Number(f.added ?? 0)}</td>`
    + `<td style="padding:3px 0 3px 8px;font-size:12px;color:#c5221f;text-align:right">-${Number(f.removed ?? 0)}</td></tr>`).join("");
  const rows = `
    <p style="margin:0 0 14px;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(r.summary || "(no summary)")}</p>
    <p style="margin:0 0 6px;font-size:12px;color:#8b97ac">${esc(r.by)} · built on ${esc(r.base ?? "the hub's current release")} · ${files.length} file${files.length === 1 ? "" : "s"}</p>
    ${files.length ? `<table style="border-collapse:collapse;width:100%;margin:8px 0 0">${fileRows}</table>` : ""}`;
  const patch = r.patch.length > MAX_PATCH ? r.patch.slice(0, MAX_PATCH) : r.patch;
  const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || `review-${r.id}`;
  return {
    subject: `Sandbox review: ${r.title} (${r.by})`,
    html: wrap({ heading: r.title, intro: `${r.by} sent this from the sandbox for review.`, rows,
      cta: { label: "Open the sandbox", href: preview }, hubUrl,
      footer: "Sent by the sandbox's Send to review. The change is attached as a .patch file." }),
    text: `${r.title} - from ${r.by}\n\n${r.summary}\n\nSandbox: ${preview}\nFiles:\n${files.map((f) => `  ${f.path} +${f.added ?? 0} -${f.removed ?? 0}`).join("\n")}\n`,
    attachments: patch ? [{ filename: `${slug}.patch`, content: Buffer.from(patch, "utf8"), contentType: "text/x-diff" }] : [],
  };
}

export async function sendReview(r: Review, sandbox: string): Promise<void> {
  const to = process.env.SANDBOX_REVIEW_TO;
  if (!to) throw new Error("SANDBOX_REVIEW_TO is not set");
  const m = reviewMail(r, sandbox, hubPublicUrl());
  await sendHubMail({ to, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments, fromName: `${r.by} via the sandbox` });
}
