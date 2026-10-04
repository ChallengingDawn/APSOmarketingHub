// The declaration email exactly as this customer gets it - their language, the
// greeting their contact allows - rendered without sending or writing anything.
// Opened in a new tab from the DoC board; a short header above the email lists
// which declarations would be attached and which positions have none.

import { NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { preview } from "@/lib/doc/engine";
import { esc } from "@/lib/doc/email";
import { missingForDocuments } from "@/lib/doc/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const page = (status: number, msg: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><p style="font-family:Arial;padding:24px;color:#5b6470">${msg}</p>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function GET(req: NextRequest) {
  if (!(await getOptionalUser())) return page(401, "Not signed in.");
  const missing = missingForDocuments();
  if (missing.length) return page(503, `Not configured on this deployment: ${esc(missing.join(", "))}.`);

  const web = (req.nextUrl.searchParams.get("web") ?? "").replace(/\D/g, "");
  if (!web) return page(400, "Which order? (?web=&lt;shop order number&gt;)");
  const lang = req.nextUrl.searchParams.get("lang");

  try {
    const v = await preview(web, { lang });
    const attached = v.groups.length
      ? v.groups.map((g) => `<li>${esc(g.file)} - ${esc(g.compound)}, ${g.positions.length} position(s)</li>`).join("")
      : "<li><b>none</b> - this order would go to the Back Office as a CERTIFICATES ticket</li>";
    const without = v.notEligible.length
      ? `<p style="margin:6px 0 0"><b>Without a declaration (left out):</b> ${v.notEligible.map((n) => `${esc(n.sku)} ${esc(n.name)}`).join(" · ")}</p>`
      : "";
    const banner = `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#33475b;background:#fff8e1;border-bottom:1px solid #f0d58c;padding:12px 20px">
<b>Preview only - nothing is sent.</b> To: ${esc(v.recipient)} · ${esc(v.lang)} · ${v.greeting.personal ? "personal" : "generic"} greeting · Subject: ${esc(v.mail.subject)}
<ul style="margin:6px 0 0;padding-left:18px">${attached}</ul>${without}</div>`;
    return new Response(v.mail.html.replace(/<body([^>]*)>/, `<body$1>${banner}`), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return page(502, `No preview: ${esc((err as Error).message)}`);
  }
}
