"use client";
// EACH LANGUAGE'S LAST EXPORT, IN THE FILM'S LAST STEP (cv17, SARCLA 11.11.2026: "continue" - what cv16 left open). Every
// export for the render machine is recorded in the film's document (model.ts ExportRecord: when, which language, by whom,
// the file); here, a line per language: its last file, when and who - "the film changed since" when what it would export
// now is not what was exported then (model.ts filmPrint) - or "not exported yet". The library's card says the same in
// short: "Exported · DE, FR".

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { MUTED } from "@/app/uc/report/ui";
import { languageLabel } from "@/lib/content/languages";
import { filmPrint, languagesOf, lastExports, type VideoDoc } from "@/lib/content/studio/kinds/video/model";

/** "11 Nov, 14:02" - the year too when it is not this one. */
export function exportedWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" });
}

export default function Exported({ film, me, people = [] }: { film: VideoDoc; me: string; people?: readonly { username: string; name: string }[] }) {
  const last = lastExports(film);
  const langs = languagesOf(film);
  if (!Object.keys(last).length) return null;
  const who = (u: string) => (!u ? "" : u === me ? "you" : people.find((p) => p.username === u)?.name ?? u);
  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Exported</Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.6 }}>
        {langs.map((l) => {
          const x = last[l];
          const changed = !!x?.print && x.print !== filmPrint(film, l, x.format);
          return (
            <Box component="li" key={l} sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
              <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, alignSelf: "center", bgcolor: !x ? "#c7cfdb" : changed ? "#c27a12" : "#1b7a55" }} />
              <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 750, color: "#15223a" }}>{l}</Typography>
              {x ? (
                <>
                  <Typography component="span" sx={{ fontSize: "0.78rem", color: "#15223a", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{x.file || `${x.format} story`}</Typography>
                  <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED, ml: "auto", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {[exportedWhen(x.at), who(x.by)].filter(Boolean).join(" · ")}
                  </Typography>
                  {changed && <Typography component="span" sx={{ flexBasis: "100%", pl: 1.6, fontSize: "0.74rem", color: "#a96a12" }}>The film changed since - export {languageLabel(l) || l} again for the render.</Typography>}
                </>
              ) : (
                <Typography component="span" sx={{ fontSize: "0.78rem", color: MUTED }}>{languageLabel(l) || l} - not exported yet</Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
