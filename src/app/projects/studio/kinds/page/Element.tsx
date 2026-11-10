"use client";
// THE SELECTED ELEMENT (SARCLA 08.11.2026: "the page editor should allow element select for editing and so forth; it
// should be a real AI-assisted CMS"). What a click in the preview selected (`Selection`), and a banner placed in the page.
//
// Content v8 (SARCLA 10.11.2026, points 1-4): an element's words, picture and look are no longer a form in the Build pane -
// they are edited ON the page, in the popup at the element (./pops.tsx: TextPop, PicturePop, BlockSettingsPop,
// ShopBlockPop); a banner's place is its settings popup there (InsertPanel below).

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { INK } from "@/app/uc/report/ui";
import { INSERT_WHERE, INSERT_WHERE_LABEL, type InsertWhere, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import type { InsertOut } from "@/lib/content/studio/kinds/page/shop";
import { btn } from "../../parts";
import type { Picked } from "./Frame";
import { Chip, Choice, Hint, Kicker } from "./ui";

export type Selection = { key: string; picked: Picked | null };

/* ── a banner placed in the page ──────────────────────────────────────── */

export function InsertPanel({ view, setView, id, inserts, record }: { view: PageDoc; setView: (v: PageDoc) => void; id: string; inserts: InsertOut[] | null; record: (label: string) => void }) {
  const ins = view.inserts.find((x) => x.id === id);
  const out = inserts?.find((x) => x.id === id);
  if (!ins) return <Hint mt={0}>This banner is no longer in the page.</Hint>;
  return (
    <Box>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 0.5 }}>{out?.title ?? "A banner"}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, mb: 1.5 }}><Chip tint="purple">Banner</Chip><Chip tint="slate">{ins.preset}</Chip></Box>
      {out && !out.ok && <Typography sx={{ fontSize: "0.82rem", color: "#a96a12", mb: 1 }}>{out.error}</Typography>}
      <Kicker mt={0}>Where it is</Kicker>
      <Choice value={ins.where} onChange={(where: InsertWhere) => setView({ ...view, inserts: view.inserts.map((x) => (x.id === id ? { ...x, where } : x)) })}
        options={INSERT_WHERE.map((k) => ({ key: k, label: INSERT_WHERE_LABEL[k] }))} />
      <Hint>The banner is edited in its own to-do (Banner); it shows here as it is there.</Hint>
      <Button size="small" onClick={() => { record("Took a banner out of the page"); setView({ ...view, inserts: view.inserts.filter((x) => x.id !== id) }); }} sx={{ ...btn, color: "#c5221f", px: 0, mt: 1.5 }}>Take it out of the page</Button>
    </Box>
  );
}
