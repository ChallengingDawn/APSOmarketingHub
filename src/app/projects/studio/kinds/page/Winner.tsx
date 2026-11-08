"use client";
// A TEST'S WINNER, PUBLISHED FROM CONTENT (SARCLA 08.11.2026: "Ship should not come from here; content publish should go
// to Content, where we should be able to visualise, even slightly edit with AI recommendations for it").
// APSOconvert tested the version and handed it over (the brief's marker names the test); here it is laid over the page,
// may be adjusted - a list changed after the test is said in red, it goes out as it was not tested - and published once
// its reviewer approved it, by someone with Edit on APSOconvert's Ship. The way out is APSOconvert's
// (lib/convert/winner.ts): the Magento page, on for everyone through the shop's gateway, or the code for dotSource.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { WAY_LABEL, sameChangeList, type PageDoc, type Published } from "@/lib/content/studio/kinds/page/model";
import type { Change } from "@/lib/convert/versions";
import { btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Chip, Hint } from "./ui";

const RED = "#c5221f";
const pct = (r: number | null | undefined) => (r === null || r === undefined ? "-" : `${(r * 100).toFixed(1)} %`);
const signed = (r: number | null | undefined) => (r === null || r === undefined ? "-" : `${r >= 0 ? "+" : ""}${(r * 100).toFixed(1)} %`);
const day = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

type WinnerInfo = { testId: string; tested: Change[]; shipped: { id: string; status: string } | null; name: string };

/** The winner as the server knows it now: the tested list (to tell an edit), published already, may I publish. */
export function useWinner(api: StudioApi, on: boolean) {
  const [info, setInfo] = useState<WinnerInfo | null>(null);
  const [may, setMay] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.act<{ winner: WinnerInfo | null; mayShip?: boolean }>("winner");
    if (!r.ok) { setErr(r.error); return; }
    setErr(null);
    setInfo(r.result.winner);
    setMay(r.result.mayShip === true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.data.piece.id]);
  useEffect(() => { if (on) void load(); }, [on, load]);
  return { info, may, err, reload: load };
}

/** What the test showed, on the Page step. */
export function WinnerCard({ doc, info }: { doc: PageDoc; info: WinnerInfo | null }) {
  const t = doc.origin?.test;
  if (!t) return null;
  const edited = !!info && !sameChangeList(doc.changes, info.tested);
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", p: 1.5, mb: 1.25, bgcolor: "#f6fbf8" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
        <EmojiEventsOutlinedIcon sx={{ fontSize: 18, color: "#1b7a55" }} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1 }}>Winner of page test #{t.id}</Typography>
        {doc.published ? <Chip tint="green">Published</Chip> : <Chip tint="green">Tested</Chip>}
      </Box>
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#1b7a55", lineHeight: 1.2 }}>{signed(t.uplift)}</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.25 }}>
        {pct(t.rateB)} of the visitors who got the version put something in the cart, against {pct(t.rateA)} for the page as it is.
      </Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5 }}>
        {[t.pB !== null ? `${Math.round(t.pB * 100)} % sure it is better` : null, t.visitors ? `${t.visitors.toLocaleString("de-CH")} visitors` : null, t.days ? `${t.days} days` : null,
          t.decidedBy ? `decided by ${t.decidedBy}${t.decidedAt ? ` on ${day(t.decidedAt)}` : ""}` : null].filter(Boolean).join(" · ")}
      </Typography>
      {doc.origin?.summary && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.75 }}>{doc.origin.summary}</Typography>}
      {edited && (
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: RED, mt: 0.75 }}>
          Edited after the test - it goes out as it was not tested.
        </Typography>
      )}
    </Box>
  );
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const packageText = (p: NonNullable<Published["package"]>, testId: string) =>
  `# The winner of page test #${testId} - for dotSource\n\n${p.description}\n\n## Stylesheet\n\n\`\`\`css\n${p.css}\n\`\`\`\n\n## Script (ES5)\n\n\`\`\`js\n${p.js}\n\`\`\`\n`;

/** The Publish step for a winner: one button, once approved and allowed. */
export function WinnerPublish({ api, doc, info, may, err, reload }: { api: StudioApi; doc: PageDoc; info: WinnerInfo | null; may: boolean; err: string | null; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const p = api.data.piece;
  const t = doc.origin?.test;
  const edited = !!info && !sameChangeList(doc.changes, info.tested);
  const pub = doc.published;
  const why =
    !api.data.access.canEdit ? "You can comment on this project, not publish from it."
    : p.status !== "approved" ? (p.status === "review" ? "Waiting for its reviewer's approval - it is published once approved." : "Ask for review first (top right) - it is published once approved.")
    : !may ? "Publishing a winner needs Edit on Website > AI testing & personalization > Ship - an admin gives it under Users."
    : null;

  const go = async () => {
    if (!window.confirm(`Publish this page on the shop?${edited ? "\n\nIt was edited after the test - it goes out as it was NOT tested." : ""}`)) return;
    setBusy(true); setMsg(null);
    const r = await api.act<{ published: Published }>("publish");
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    const out = r.result.published;
    if (out.package && t) download(packageText(out.package, t.id), `test-${t.id}-winner-for-dotsource.md`);
    // on the shop now: the to-do goes live (its writer and the project's owner hear of it)
    if (out.way !== "dotsource") await api.move("live");
    await api.reload();
    await reload();
  };

  if (pub) {
    return (
      <Box>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.75, flexWrap: "wrap" }}>
          <Chip tint="green">{WAY_LABEL[pub.way]}</Chip>
          {pub.edited && <Chip tint="amber">Edited after the test</Chip>}
        </Box>
        <Typography sx={{ fontSize: "0.82rem", color: INK }}>
          Published on {day(pub.at)} by {api.data.people.find((x) => x.username === pub.by)?.name ?? pub.by}{pub.id ? ` · #${pub.id}` : ""}.
        </Typography>
        {pub.way === "everyone" && <Hint>It runs on the shop's gateway; switching it off is in AI testing &amp; personalization.</Hint>}
        {pub.way === "cms" && <Hint>The page&apos;s content was backed up before the write (#{pub.id}).</Hint>}
        {pub.way === "dotsource" && pub.package && t && (
          <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={() => download(packageText(pub.package!, t.id), `test-${t.id}-winner-for-dotsource.md`)} sx={{ ...btn, mt: 1, px: 0 }}>
            The code for dotSource again
          </Button>
        )}
      </Box>
    );
  }
  return (
    <Box>
      <Typography sx={{ fontSize: "0.84rem", color: INK, mb: 1 }}>
        The page goes out the way APSOconvert takes for it: written into the Magento page when it is a CMS page and the hub has its keys, else on for everyone through the shop&apos;s gateway, else as code for dotSource (downloaded here).
      </Typography>
      {info?.shipped && (info.shipped.status === "running" || info.shipped.status === "paused") && (
        <Typography sx={{ fontSize: "0.8rem", color: "#a96a12", mb: 1 }}>It is on for everyone already (#{info.shipped.id}) - set in AI testing &amp; personalization.</Typography>
      )}
      {edited && <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: RED, mb: 1 }}>Edited after the test - it goes out as it was not tested.</Typography>}
      <Button variant="contained" disableElevation disabled={!!why || busy || !t} onClick={() => void go()}
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined} sx={{ ...mainBtn, width: "100%" }}>
        Publish on the shop
      </Button>
      {(why || msg || err) && <Typography sx={{ fontSize: "0.8rem", color: msg || err ? RED : MUTED, mt: 1 }}>{msg ?? err ?? why}</Typography>}
    </Box>
  );
}
