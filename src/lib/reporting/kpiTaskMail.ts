// THE MAIL A PERSON GETS WHEN A DIGITAL GROWTH KPI TASK IS GIVEN TO THEM OR SHARED WITH THEM
// (SARCLA 18.10.2026: "shared users, so you can share inside of the hub via mail notification").
// In the hub's notification frame, "from" the person who made the task, a reply going to them.

import { esc, wrap } from "@/lib/notify/mailer";
import { hubPublicUrl } from "@/lib/content/shareMail";
import type { KpiTask } from "./kpiActions";

export function renderTaskMail(m: { task: KpiTask; kpi: string; summary?: string; byName: string; toName: string; role: "owner" | "shared" }): { subject: string; html: string; text: string } {
  const t = m.task;
  const link = t.href.startsWith("/reporting/") ? `${hubPublicUrl()}${t.href}` : `${hubPublicUrl()}/reporting/marketing-kpis`;
  const due = t.due ? t.due.split("-").reverse().join(".") : "";
  const subject = m.role === "owner" ? `A task for you on ${m.kpi}: ${t.title}` : `${m.byName} shared a task on ${m.kpi}: ${t.title}`;
  const facts = [
    ["The KPI", `${m.kpi}${m.summary ? ` - ${m.summary}` : ""}`],
    ["Who", t.ownerName || "-"],
    ...(due ? [["By", due]] : []),
    ...(t.shared.length ? [["Shared with", t.shared.map((p) => p.name).join(", ")]] : []),
  ];
  const rows = `<div style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #2459d1;background:#f5f6fa;border-radius:8px">
      <div style="font-size:15px;color:#15223a;font-weight:700;margin-bottom:6px">${esc(t.title)}</div>
      ${t.note ? `<div style="font-size:14px;color:#5d6b85;line-height:1.55;white-space:pre-wrap">${esc(t.note)}</div>` : ""}
    </div>
    <table style="font-size:13px;color:#5d6b85;border-collapse:collapse">${facts.map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;color:#8b97ac">${esc(k)}</td><td style="padding:2px 0;color:#15223a">${esc(v)}</td></tr>`).join("")}</table>`;
  const html = wrap({
    heading: m.role === "owner" ? "A task for you" : `${m.byName} shared a task with you`,
    intro: `Hello ${m.toName}, ${m.role === "owner" ? `${m.byName} gave you a task` : "a task was shared with you"} to move a Digital Growth KPI.`,
    rows,
    cta: { label: "Open the KPI", href: link },
    hubUrl: hubPublicUrl(),
    footer: `Sent by APSOhub because ${m.byName} ${m.role === "owner" ? "gave you" : "shared"} a task on the Digital Growth KPIs. Reply to this email to answer ${m.byName}.`,
  });
  const text = [
    `Hello ${m.toName},`, "",
    m.role === "owner" ? `${m.byName} gave you a task on ${m.kpi}:` : `${m.byName} shared a task on ${m.kpi} with you:`,
    t.title, ...(t.note ? [t.note] : []), "",
    ...facts.map(([k, v]) => `${k}: ${v}`), "",
    `Open it: ${link}`,
  ].join("\n");
  return { subject, html, text };
}
