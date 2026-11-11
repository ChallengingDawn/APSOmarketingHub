"use client";
// WHAT A FILM GIVES AS FILES - the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be able to
// download"). What exists: the story for the render machine (the "export" read - its checks first), as its last step
// gives it; the MP4 is made from it on the render laptop (the hub cannot - no Chromium on its servers). cv16 (11.11.2026):
// one file a language - the film's own first, then each of its versions, each in the film's own format.

import { FORMATS, cleanVideo, languagesOf, type Format, type VideoSpec } from "@/lib/content/studio/kinds/video/model";
import { fileStem, saveFile, type DownloadsOf } from "../../frame";

export const downloads: DownloadsOf = (api) => {
  const film = cleanVideo(api.doc, { language: api.data.piece.language });
  if (!film.scenes.length) return [];
  const langs = languagesOf(film);
  const many = langs.length > 1;
  const one = (format: Format, lang: string) => ({
    key: `spec:${format}:${lang}`, group: "The story for the render machine", label: `${many ? `${lang} · ` : ""}${format} · JSON`,
    sub: lang !== film.language ? "The same film in this language - the render makes all three formats from it" : format === film.format ? "The film's own format - the render makes all three from it" : "The same story, in this format",
    disabled: api.data.access.canEdit ? null : "For the project's editors.",
    run: async () => {
      const r = await api.act<{ spec: VideoSpec | null; issues: { level: string; text: string }[] }>("export", { format, lang });
      if (!r.ok) return r.error;
      if (!r.result.spec) return `Not yet: ${r.result.issues.filter((x) => x.level === "stop").map((x) => x.text).join(" ")}`;
      saveFile(JSON.stringify(r.result.spec, null, 2), `${fileStem(api.data.piece.title)}${many ? `-${lang.toLowerCase()}` : ""}-${format.replace(":", "x")}.json`, "application/json");
      return "Saved - the render laptop makes the MP4 from it (the film's last step has the command).";
    },
  });
  return [
    ...[film.format, ...FORMATS.filter((f) => f !== film.format)].map((f) => one(f, film.language)),
    ...langs.slice(1).map((l) => one(film.format, l)),
  ];
};
