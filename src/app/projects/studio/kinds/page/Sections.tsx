"use client";
// THE PAGE STUDIO'S SMALLER SECTIONS (08.11.2026): the texts Content writes for the version's placeholders, the A/B test's
// plan, and the hand-over to Magento (what to copy in by hand - since 09.11.2026 the last step writes CMS pages through
// Magento's API itself, ./Publish.tsx; the hand-over stays for what it does not write, and the pictures).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Link from "next/link";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  AB_AUDIENCE_LABEL, AB_GOAL_LABEL, abLine, languageOfStore, lettersOf, mergeTexts, placeholdersOf, sideName, type AbAudience, type AbGoal, type PageDoc, type PasteBlock,
} from "@/lib/content/studio/kinds/page/model";
import type { PasteOut } from "@/lib/content/studio/kinds/page/shop";
import { AB_TESTING_HREF } from "@/lib/content/abPlanned";
import { Field, PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Block, Choice, Hint, PasteCard, useCopy } from "./ui";

/* ── texts ────────────────────────────────────────────────────────────── */

export function Texts({ d, set, canEdit }: { d: PageDoc; set: (next: PageDoc) => void; canEdit: boolean }) {
  const holders = placeholdersOf(d);
  if (!holders.length) {
    return <Hint mt={0}>A change can leave its longer words to Content as a placeholder - [Text from Content: what they must do]. Each shows here, to write.</Hint>;
  }
  const textOf = (id: string) => d.texts.find((t) => t.id === id)?.text ?? "";
  return (
    <Box>
      {holders.map((p) => (
        <Box key={p.id} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, mb: 0.25 }}>{p.ask}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 0.75 }}>In {p.where}</Typography>
          <Field label="The words" value={textOf(p.id)} multiline rows={3} disabled={!canEdit}
            onChange={(v) => set({ ...d, texts: mergeTexts(d.texts, [{ id: p.id, ask: p.ask, text: v }]) })} />
        </Box>
      ))}
    </Box>
  );
}

/* ── the A/B test ─────────────────────────────────────────────────────── */
// SARCLA 09.11.2026 on the panel as it was ("Test the new version against the page as it is · Running it · Not running ·
// The new version reaches visitors through a small script served from a gateway on Railway ..."): "Too much
// information here". One line of state, one obvious action; the plan once it is on (which two run - the page as it is
// or a version A, B, C - who sees the second, what decides it). Content v7 (SARCLA 10.11.2026): the explanation is out
// entirely ("take out this message"), and a planned test shows in Website > A/B testing, linked from here ("should you
// update the A/B testing link?").

export function AbTest({ d, set, canEdit }: { d: PageDoc; set: (next: PageDoc) => void; canEdit: boolean }) {
  const ab = d.abTest;
  const up = (p: Partial<PageDoc["abTest"]>) => set({ ...d, abTest: { ...ab, ...p } });
  const letters = lettersOf(d);
  // the two that run: what is tested (a version), and what it is tested against (the page as it is, or another version)
  const tested = ab.b === "page" ? ab.a : ab.b;
  const against = ab.b === "page" ? "page" : ab.a;
  const pair = (t: string, x: string) => up({ a: x === t ? "page" : x, b: t });
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: ab.enabled ? 1.5 : 0.75 }}>
        <Typography sx={{ fontSize: "0.88rem", color: INK, fontWeight: 650, flex: 1, minWidth: 0 }}>{abLine(d)}</Typography>
        {canEdit && (ab.enabled
          ? <Button size="small" onClick={() => up({ enabled: false })} sx={{ ...btn, color: MUTED, px: 0.75 }}>Switch off</Button>
          : <Button size="small" variant="contained" disableElevation onClick={() => up({ enabled: true, a: "page", b: d.letter || "A" })} sx={{ ...mainBtn, borderRadius: "6px", px: 1.5 }}>Plan an A/B test</Button>)}
      </Box>
      {ab.enabled && (
        <>
          {letters.length > 1 && (
            <>
              <Box sx={{ mb: 1 }}><Choice label="Test" value={tested} onChange={(t: string) => canEdit && pair(t, against === t ? "page" : against)} options={letters.map((l) => ({ key: l, label: `Version ${l}` }))} /></Box>
              <Box sx={{ mb: 1.5 }}><Choice label="Against" value={against} onChange={(x: string) => canEdit && pair(tested, x)}
                options={[{ key: "page", label: "The page as it is" }, ...letters.filter((l) => l !== tested).map((l) => ({ key: l, label: `Version ${l}` }))]} /></Box>
            </>
          )}
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.25 }}>Visitors who see {sideName(ab.b).replace(/^./, (c) => c.toLowerCase())}: <b style={{ color: INK }}>{ab.split}%</b></Typography>
          <Slider value={ab.split} min={10} max={90} step={5} disabled={!canEdit} onChange={(_, v) => up({ split: v as number })}
            sx={{ color: PINK, mb: 1, mx: 1, width: "calc(100% - 16px)" }} />
          <Box sx={{ mb: 1 }}><Choice label="Decided by" value={ab.goal} onChange={(goal: AbGoal) => canEdit && up({ goal })} options={(Object.keys(AB_GOAL_LABEL) as AbGoal[]).map((k) => ({ key: k, label: AB_GOAL_LABEL[k] }))} /></Box>
          {ab.goal === "clicks" && <Field label="Which element (its words or a selector)" value={ab.clickTarget} onChange={(v) => up({ clickTarget: v })} disabled={!canEdit} />}
          <Box sx={{ mb: 1 }}><Choice label="Who" value={ab.audience} onChange={(audience: AbAudience) => canEdit && up({ audience })} options={(Object.keys(AB_AUDIENCE_LABEL) as AbAudience[]).map((k) => ({ key: k, label: AB_AUDIENCE_LABEL[k] }))} /></Box>
          {ab.notes.trim() && <Field label="Notes for the test" value={ab.notes} onChange={(v) => up({ notes: v })} multiline rows={2} disabled={!canEdit} />}
        </>
      )}
      {ab.enabled && (
        <Button size="small" component={Link} href={AB_TESTING_HREF} target="_blank" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          sx={{ ...btn, px: 0, minWidth: 0, color: PINK, fontSize: "0.78rem" }}>See it in Website &gt; A/B testing</Button>
      )}
    </Box>
  );
}

/* ── Magento ──────────────────────────────────────────────────────────── */

export function Publish({ api, d, set, canEdit, lang }: { api: StudioApi; d: PageDoc; set: (next: PageDoc) => void; canEdit: boolean; lang: string }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ blocks: PasteBlock[]; warnings: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { done, copy } = useCopy();
  // another store view is another page in Magento: what was prepared belongs to the one it was prepared for
  useEffect(() => { setOut(null); setErr(null); }, [lang]);
  const prepare = async () => {
    setBusy(true); setErr(null);
    const r = await api.act<PasteOut>("paste", { lang });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (!r.result.ok) { setErr(r.result.error); return; }
    setOut({ blocks: r.result.blocks, warnings: r.result.warnings });
  };
  return (
    <Box>
      <Box>
        <Hint mt={0}>The {d.store} page ({languageOfStore(d.store) ?? lang}) as it will be, with where each part goes in Magento - to copy in by hand. Each store view is its own page there: switch the store view above the preview for the others.</Hint>
        <Button fullWidth variant={out ? "outlined" : "contained"} disableElevation disabled={busy || !canEdit} onClick={prepare}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={out ? { ...btn, mt: 1.25, mb: 1.5, borderColor: HAIRLINE, color: INK } : { ...mainBtn, mt: 1.25, mb: 1.5 }}>
          {out ? "Prepare it again" : "Prepare the copy for Magento"}
        </Button>
        {err && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f", mb: 1 }}>{err}</Typography>}
        {out?.warnings.map((w) => <Typography key={w} sx={{ fontSize: "0.8rem", color: AMBER, mb: 0.75 }}>{w}</Typography>)}
        {out?.blocks.map((b) => (
          <PasteCard key={b.key} label={b.label} steps={b.steps} code={b.code} copied={done === b.key}
            onCopy={() => { void copy(b.key, b.code); if (canEdit && d.publish.status !== "copied") set({ ...d, publish: { ...d.publish, status: "copied" } }); }} />
        ))}
      </Box>
      <Block title="Notes for the hand-over">
        <Field label="For whoever puts it live" value={d.publish.notes} onChange={(v) => set({ ...d, publish: { ...d.publish, notes: v } })} multiline rows={2} disabled={!canEdit} />
      </Block>
    </Box>
  );
}
