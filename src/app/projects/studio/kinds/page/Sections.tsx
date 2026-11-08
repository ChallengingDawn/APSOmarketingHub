"use client";
// THE PAGE STUDIO'S SMALLER SECTIONS (08.11.2026): the texts Content writes for the version's placeholders, the A/B test's
// plan, and the way to Magento (a paste block today; publishing waits for CMS keys for ACC).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  AB_AUDIENCE_LABEL, AB_GOAL_LABEL, mergeTexts, placeholdersOf, type AbAudience, type AbGoal, type PageDoc, type PasteBlock,
} from "@/lib/content/studio/kinds/page/model";
import type { PasteOut } from "@/lib/content/studio/kinds/page/shop";
import { Field, PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Block, Chip, Choice, Hint, PasteCard, useCopy } from "./ui";

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

export function AbTest({ d, set, canEdit }: { d: PageDoc; set: (next: PageDoc) => void; canEdit: boolean }) {
  const ab = d.abTest;
  const up = (p: Partial<PageDoc["abTest"]>) => set({ ...d, abTest: { ...ab, ...p } });
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: "0.88rem", color: INK, flex: 1 }}>Test the new version against the page as it is</Typography>
        <Switch checked={ab.enabled} disabled={!canEdit} onChange={(e) => up({ enabled: e.target.checked })}
          sx={{ "& .Mui-checked": { color: `${PINK} !important` }, "& .Mui-checked + .MuiSwitch-track": { bgcolor: `${PINK} !important` } }} />
      </Box>
      {ab.enabled && (
        <>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Visitors who see the new version: <b style={{ color: INK }}>{ab.split}%</b></Typography>
          <Slider value={ab.split} min={10} max={90} step={5} disabled={!canEdit} onChange={(_, v) => up({ split: v as number })}
            sx={{ color: PINK, mb: 1.5, mx: 1, width: "calc(100% - 16px)" }} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.75 }}>What decides it</Typography>
          <Box sx={{ mb: 1.25 }}><Choice value={ab.goal} onChange={(goal: AbGoal) => canEdit && up({ goal })} options={(Object.keys(AB_GOAL_LABEL) as AbGoal[]).map((k) => ({ key: k, label: AB_GOAL_LABEL[k] }))} /></Box>
          {ab.goal === "clicks" && <Field label="Which element (its words or a selector)" value={ab.clickTarget} onChange={(v) => up({ clickTarget: v })} disabled={!canEdit} />}
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.75 }}>Who takes part</Typography>
          <Box sx={{ mb: 1.5 }}><Choice value={ab.audience} onChange={(audience: AbAudience) => canEdit && up({ audience })} options={(Object.keys(AB_AUDIENCE_LABEL) as AbAudience[]).map((k) => ({ key: k, label: AB_AUDIENCE_LABEL[k] }))} /></Box>
          <Field label="Notes for the test" value={ab.notes} onChange={(v) => up({ notes: v })} multiline rows={2} disabled={!canEdit} />
        </>
      )}
      <Box sx={{ mt: 1, p: 1.5, borderRadius: "12px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, flex: 1 }}>Running it</Typography>
          <Chip tint="amber">Not running</Chip>
        </Box>
        <Box component="ol" sx={{ m: 0, pl: 2.25, color: MUTED, fontSize: "0.8rem", lineHeight: 1.55 }}>
          <li>The new version reaches visitors through a small script served from a gateway on Railway - the hub has no public address. The chat&apos;s A/B test works this way.</li>
          <li>The shop&apos;s footer loads that script once.</li>
          <li>The gateway counts visitors and the goal for each version; the hub reads the results.</li>
        </Box>
        <Hint mt={1}>The plan is kept here with the page, so the test starts from it.</Hint>
      </Box>
    </Box>
  );
}

/* ── Magento ──────────────────────────────────────────────────────────── */

export function Publish({ api, d, set, canEdit }: { api: StudioApi; d: PageDoc; set: (next: PageDoc) => void; canEdit: boolean }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ blocks: PasteBlock[]; warnings: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { done, copy } = useCopy();
  const prepare = async () => {
    setBusy(true); setErr(null);
    const r = await api.act<PasteOut>("paste");
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (!r.result.ok) { setErr(r.result.error); return; }
    setOut({ blocks: r.result.blocks, warnings: r.result.warnings });
  };
  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Choice value={d.publish.mode} onChange={(mode: "paste" | "magento") => canEdit && set({ ...d, publish: { ...d.publish, mode } })}
          options={[{ key: "paste", label: "Copy for Magento" }, { key: "magento", label: "Publish to Magento" }]} />
      </Box>
      {d.publish.mode === "magento" ? (
        <Box>
          <Tooltip title="Needs CMS keys for ACC first">
            <span><Button fullWidth variant="contained" disableElevation disabled sx={mainBtn}>Publish to Magento</Button></span>
          </Tooltip>
          <Hint>Needs CMS keys for ACC first: the hub reads Magento with keys other jobs share, and writes nothing there. Until then, copy the page into Magento.</Hint>
        </Box>
      ) : (
        <Box>
          <Hint mt={0}>The page as it will be, with where each part goes in Magento. Nothing is sent to the shop from here.</Hint>
          <Button fullWidth variant={out ? "outlined" : "contained"} disableElevation disabled={busy || !canEdit} onClick={prepare}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={out ? { ...btn, mt: 1.25, mb: 1.5, borderColor: HAIRLINE, color: INK } : { ...mainBtn, mt: 1.25, mb: 1.5 }}>
            {out ? "Prepare it again" : "Prepare the copy"}
          </Button>
          {err && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f", mb: 1 }}>{err}</Typography>}
          {out?.warnings.map((w) => <Typography key={w} sx={{ fontSize: "0.8rem", color: AMBER, mb: 0.75 }}>{w}</Typography>)}
          {out?.blocks.map((b) => (
            <PasteCard key={b.key} label={b.label} steps={b.steps} code={b.code} copied={done === b.key}
              onCopy={() => { void copy(b.key, b.code); if (canEdit && d.publish.status !== "copied") set({ ...d, publish: { ...d.publish, status: "copied" } }); }} />
          ))}
        </Box>
      )}
      <Block title="Notes for the hand-over">
        <Field label="For whoever puts it live" value={d.publish.notes} onChange={(v) => set({ ...d, publish: { ...d.publish, notes: v } })} multiline rows={2} disabled={!canEdit} />
      </Block>
    </Box>
  );
}
