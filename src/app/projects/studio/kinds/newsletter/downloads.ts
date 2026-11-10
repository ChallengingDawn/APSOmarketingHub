"use client";
// WHAT A NEWSLETTER GIVES AS FILES - the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be
// able to download"): the e-mail's HTML, as HubSpot or any mail tool takes it (the studio's `html` read - the same
// renderEmail the HubSpot draft gets; pictures kept in the hub carry the hub's address).

import { fileStem, saveFile, type DownloadsOf } from "../../frame";

export const downloads: DownloadsOf = (api) => [{
  key: "html", group: "", label: "The e-mail · HTML", sub: "Ready for HubSpot or any mail tool",
  disabled: api.data.access.canEdit ? null : "For the project's editors.",
  run: async () => {
    const r = await api.act<{ html: string }>("html");
    if (!r.ok) return r.error;
    const d = (api.doc ?? {}) as { subject?: string };
    saveFile(r.result.html, `${fileStem(d.subject || api.data.piece.title)}.html`);
    return null;
  },
}];
