// APSOconvert > THE LIVE PREVIEW: GET ?env=prod|acc&path=/de-CH/...[&v=<version id>[&r=<revision>]] answers the shop's
// page as an HTML document for the preview's frame - cleaned (src/lib/convert/preview.ts: no tracking, no request out,
// its own origin) and, with a version, the version laid over it (src/lib/convert/versions.ts). Its own headers: the
// hub's "never in a frame" headers are left off this address in next.config.ts, it may be framed by the hub only.
import { NextRequest } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { ENVS, isEnv } from "@/lib/convert/model";
import { cleanPage, previewCsp, shimSource, staticBase } from "@/lib/convert/preview";
import { hubOriginOf, rewriteShopUrls, warmFiles } from "@/lib/convert/assets";
import { cleanPath, revisionChanges, shopPage, themeAssets, versionById } from "@/lib/convert/studio";
import { runtimeSource, type Change } from "@/lib/convert/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers(env: "prod" | "acc", hub?: string): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": previewCsp(ENVS[env].base, hub),
    "Cache-Control": "no-store",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
function message(env: "prod" | "acc", text: string, status = 200): Response {
  const html = `<!doctype html><meta charset="utf-8"><body style="font:15px/1.5 system-ui,sans-serif;color:#5e5e5e;padding:48px;text-align:center">${esc(text)}<script>${shimSource()}</script>`;
  return new Response(html, { status, headers: headers(env) });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const envRaw = sp.get("env");
  const env = isEnv(envRaw) ? envRaw : "prod";
  const access = await myAccess();
  if (!access) return message(env, "Your hub session has ended - sign in again.", 401);
  if (!access.canOpen("website")) return message(env, "No access to the Website area.", 403);
  const path = cleanPath(sp.get("path"));
  if (!path) return message(env, "This address is not a shop page the preview shows (cart, account and search stay out).", 400);

  let changes: Change[] | null = null;
  const v = sp.get("v");
  if (v && /^\d{1,12}$/.test(v)) {
    const version = await versionById(v).catch(() => null);
    if (!version) return message(env, "This version is gone.", 404);
    const r = Number.parseInt(sp.get("r") ?? "", 10);
    changes = Number.isInteger(r) && r > 0 && r !== version.rev ? await revisionChanges(v, r).catch(() => null) : version.changes;
    if (!changes) return message(env, "This revision is gone.", 404);
  }

  let page;
  try {
    page = await shopPage(env, path, sp.get("fresh") === "1");
  } catch (e) {
    return message(env, `The shop did not answer: ${(e as Error).message}`, 502);
  }
  if (page.status !== 200) return message(env, `The shop answered ${page.status} for ${path}.`, 200);

  const theme = await themeAssets(staticBase(page.html));
  const head = `<script>${shimSource()}</script>${theme.css ? `<style data-apso-theme>${theme.css}</style>` : ""}`;
  const tail = changes ? `<script>${runtimeSource(changes, { report: true })}</script>` : "";
  const { html } = cleanPage(page.html, { pageUrl: page.url, head, tail, sprite: theme.sprite });
  // the shop's styles, scripts, fonts and pictures come through the hub (SARCLA 08.11.2026: the frame drew a raw page in
  // his browser - something on the way blocked the shop's own files inside it); ?direct=1 keeps the shop's addresses
  const hub = hubOriginOf(req.headers, req.nextUrl.origin);
  const direct = sp.get("direct") === "1";
  if (!direct) warmFiles(html, hub);
  return new Response(direct ? html : rewriteShopUrls(html, hub), { status: 200, headers: headers(env, direct ? undefined : hub) });
}
