"use client";

// APSOconvert's steps, one strip on each of its pages: where the page you are on sits, what comes before and after.
// Find the problem -> the ideas -> the page live with its version (its texts are written in Content Studio) -> test it
// -> ship the winner to Magento. The last two are being built (SARCLA 07.11.2026: the A/B testing section, then Magento) - they show as "next", not as links.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ACCENT, FAINT, HAIRLINE, INK, MUTED, glass } from "@/app/uc/report/ui";

export type FlowStep = "problems" | "ideas" | "preview" | "test" | "ship";
const STEPS: { key: FlowStep; name: string; line: string; href: string | null }[] = [
  { key: "problems", name: "Find", line: "Pages with traffic and little buying", href: "/website/ai-personalization/problems" },
  { key: "ideas", name: "Ideas", line: "What to change, approved by a person", href: "/website/ai-personalization/ideas" },
  { key: "preview", name: "Preview", line: "The page live with its version; texts to Content", href: "/website/ai-personalization/preview" },
  { key: "test", name: "Test", line: "Half the visitors see it, then more", href: null },
  { key: "ship", name: "Ship", line: "The winner goes into Magento", href: null },
];

export function Flow({ at, counts }: { at: FlowStep | null; counts?: Partial<Record<FlowStep, number>> }) {
  return (
    <Box component="nav" aria-label="APSOconvert steps" sx={{ ...glass, borderRadius: "18px", display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(5, minmax(0, 1fr))" }, overflow: "hidden" }}>
      {STEPS.map((s, i) => {
        const here = s.key === at;
        const n = counts?.[s.key];
        const body = (
          <Box sx={{
            display: "flex", gap: 1.25, alignItems: "center", px: { xs: 1.5, md: 2 }, py: 1.25, height: "100%", boxSizing: "border-box",
            borderRight: { sm: i < STEPS.length - 1 ? `1px solid ${HAIRLINE}` : "none" }, borderBottom: { xs: `1px solid ${HAIRLINE}`, sm: "none" },
            bgcolor: here ? "rgba(36,89,209,.07)" : "transparent", boxShadow: here ? `inset 0 -2px 0 ${ACCENT}` : "none",
            opacity: s.href ? 1 : 0.6, transition: "background-color .15s", "&:hover": s.href && !here ? { bgcolor: "rgba(21,34,58,.035)" } : {},
          }}>
            <Box sx={{
              flex: "0 0 auto", width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: 700,
              border: `1.5px solid ${here ? ACCENT : s.href ? MUTED : FAINT}`, color: here ? "#fff" : s.href ? MUTED : FAINT, bgcolor: here ? ACCENT : "transparent",
            }}>{i + 1}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: here ? ACCENT : INK, lineHeight: 1.2 }}>
                {s.name}
                {n !== undefined && <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED }}> · {n}</Typography>}
                {!s.href && <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 600, color: FAINT }}> · next</Typography>}
              </Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3, display: { xs: "none", md: "block" } }}>{s.line}</Typography>
            </Box>
          </Box>
        );
        return s.href && !here
          ? <Box key={s.key} component={Link} href={s.href} sx={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>{body}</Box>
          : <Box key={s.key} aria-current={here ? "step" : undefined} sx={{ minWidth: 0 }}>{body}</Box>;
      })}
    </Box>
  );
}

/** The preview's address for a page. */
export const previewHref = (env: string, path: string, idea?: string) =>
  `/website/ai-personalization/preview?env=${env}&path=${encodeURIComponent(path)}${idea ? `&idea=${idea}` : ""}`;

/**
 * A POST to an APSOconvert route that may answer slowly (the AI): the answer can start with spaces kept alive, a
 * refused body (the 8 KB rule, an ended session) answers HTML - both read into {ok, error}.
 */
export async function convertPost<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const raw = JSON.stringify(body);
  if (raw.length > 7800) return { ok: false, error: `Too much at once (${Math.round(raw.length / 1000)} KB) - the hub takes 8 KB per request.` };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    const text = (await r.text()).trim();
    let j: { ok?: boolean; data?: T; error?: string };
    try { j = JSON.parse(text); } catch { return { ok: false, error: r.status === 403 ? "The hub refused the request (403) - is your session still open?" : `The hub answered ${r.status}.` }; }
    if (j.ok) return { ok: true, data: j.data as T };
    return { ok: false, error: j.error ?? `The hub answered ${r.status}.` };
  } catch (e) {
    return { ok: false, error: `No answer: ${(e as Error).message}` };
  }
}
