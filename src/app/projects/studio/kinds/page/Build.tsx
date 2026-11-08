"use client";
// THE PAGE STUDIO'S BUILD PANE (08.11.2026), in five steps: the page (from AI testing & personalization, picked from the
// shop, or new), its changes, the texts Content writes, the A/B test, and Magento.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { KIND_LABEL } from "@/lib/convert/model";
import type { Change } from "@/lib/convert/versions";
import {
  SOURCE_LABEL, placeholdersOf, shopUrl, unwritten, urlKeyOf, type PageDoc, type PageSource,
} from "@/lib/content/studio/kinds/page/model";
import type { ChangeHit } from "@/lib/content/studio/kinds/page/shop";
import { Field, Pane, btn, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Changes } from "./Changes";
import { PagePicker, type Picked } from "./PagePicker";
import { AbTest, Publish, Texts } from "./Sections";
import { Block, Chip, Choice, CodeField, Hint } from "./ui";

export type Step = "page" | "changes" | "texts" | "test" | "publish";
const STORES = ["de-CH", "fr-CH", "it-CH", "en-CH", "fr-FR", "it-IT", "nl-NL", "pl-PL"];

function PageCard({ d }: { d: PageDoc }) {
  const o = d.outline && d.outline.path === d.path ? d.outline : null;
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, bgcolor: "#fff", mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
        {d.pageKind && <Chip tint="slate">{KIND_LABEL[d.pageKind]}</Chip>}
        <Chip tint={d.env === "acc" ? "amber" : "green"}>{d.env === "acc" ? "ACC" : "Production"}</Chip>
        {d.store && <Chip tint="blue">{d.store}</Chip>}
      </Box>
      {o?.h1[0] && <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{o.h1[0]}</Typography>}
      <Typography component="a" href={shopUrl(d.env, d.path)} target="_blank" rel="noopener noreferrer"
        sx={{ fontSize: "0.78rem", color: MUTED, wordBreak: "break-all", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{d.path}</Typography>
    </Box>
  );
}

function PageStep({ api, d, set, canEdit }: { api: StudioApi; d: PageDoc; set: (next: PageDoc) => void; canEdit: boolean }) {
  const [picking, setPicking] = useState(!d.path);
  const [again, setAgain] = useState<"idle" | "busy" | string>("idle");
  const sources: { key: PageSource; label: string }[] = [
    ...(d.origin || d.source === "convert" ? [{ key: "convert" as PageSource, label: "From AI testing" }] : []),
    { key: "pick", label: "A page of the shop" }, { key: "new", label: "A new page" },
  ];
  const pick = (p: Picked) => { set({ ...d, env: p.env, path: p.path, store: d.source === "new" ? d.store : p.store ?? d.store, pageKind: d.source === "new" ? d.pageKind : p.kind }); setPicking(false); };
  const takeAgain = async () => {
    if (!window.confirm("Bring the page's latest version from AI testing & personalization? It takes the place of the changes here.")) return;
    setAgain("busy");
    const r = await api.act<{ imported: unknown }>("start", { again: true });
    if (!r.ok) { setAgain(r.error); return; }
    await api.reload();
    setAgain("idle");
  };
  const np = d.newPage;
  return (
    <Box>
      <Block first title="Where it comes from">
        <Choice value={d.source} options={sources}
          onChange={(source) => { if (!canEdit) return; const across = (source === "new") !== (d.source === "new"); set({ ...d, source, path: across ? "" : d.path }); if (across) setPicking(true); }} />
      </Block>

      {d.source === "convert" && (
        <Block title={SOURCE_LABEL.convert}>
          {d.path && <PageCard d={d} />}
          {d.origin ? (
            <Box sx={{ mb: 1.25 }}>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5 }}>
                <Chip tint={d.origin.status === "approved" ? "green" : "amber"}>{d.origin.status === "approved" ? "Approved version" : "Draft version"}</Chip>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>revision {d.origin.rev}</Typography>
              </Box>
              {d.origin.idea && <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{d.origin.idea}</Typography>}
              {d.origin.summary && <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.25 }}>{d.origin.summary}</Typography>}
            </Box>
          ) : <Hint mt={0}>The page has no version in AI testing & personalization yet - its changes are made here.</Hint>}
          {canEdit && (
            <Button size="small" variant="outlined" disabled={again === "busy"} onClick={takeAgain} startIcon={again === "busy" ? <CircularProgress size={13} /> : undefined}
              sx={{ ...btn, borderColor: HAIRLINE, color: INK }}>Bring its latest version again</Button>
          )}
          {again !== "idle" && again !== "busy" && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", mt: 0.75 }}>{again}</Typography>}
        </Block>
      )}

      {d.source === "pick" && (
        <Block title="The page" right={d.path && canEdit && !picking ? <Button size="small" onClick={() => setPicking(true)} sx={btn}>Another page</Button> : undefined}>
          {d.path && <PageCard d={d} />}
          {canEdit && (picking || !d.path) && <PagePicker api={api} env={d.env} onEnv={(env) => set({ ...d, env })} onPick={pick} store={d.store} />}
        </Block>
      )}

      {d.source === "new" && (
        <>
          <Block title="The new page">
            <Field label="Its title" value={np.title} disabled={!canEdit} max={80}
              onChange={(v) => set({ ...d, newPage: { ...np, title: v, urlKey: np.urlKey && np.urlKey !== urlKeyOf(np.title) ? np.urlKey : urlKeyOf(v) } })} />
            <Field label="Its address key" value={np.urlKey} disabled={!canEdit} helper={`/${d.store}/${np.urlKey || urlKeyOf(np.title) || "…"}`}
              onChange={(v) => set({ ...d, newPage: { ...np, urlKey: urlKeyOf(v) || v.toLowerCase() } })} />
            <Field label="Meta title" value={np.metaTitle} max={60} disabled={!canEdit} placeholder={np.title} onChange={(v) => set({ ...d, newPage: { ...np, metaTitle: v } })} />
            <Field label="Meta description" value={np.metaDescription} max={155} multiline rows={2} disabled={!canEdit} onChange={(v) => set({ ...d, newPage: { ...np, metaDescription: v } })} />
            <TextField select fullWidth size="small" label="Store view" value={STORES.includes(d.store) ? d.store : ""} disabled={!canEdit} sx={{ ...field, mb: 1.25 }}
              onChange={(e) => set({ ...d, store: e.target.value, path: "" })}>
              {STORES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <CodeField label="The page (HTML)" value={np.body} rows={8} disabled={!canEdit} onChange={(v) => set({ ...d, newPage: { ...np, body: v } })}
              placeholder="The assistant writes it from the brief - or write it here." />
          </Block>
          <Block title="Shown inside" right={d.path && canEdit && !picking ? <Button size="small" onClick={() => setPicking(true)} sx={btn}>Another page</Button> : undefined}>
            <Hint mt={0}>The preview puts the new page inside one of the store&apos;s CMS pages, so it has the shop&apos;s header and footer around it.</Hint>
            {d.path && <Box sx={{ mt: 1 }}><PageCard d={{ ...d, pageKind: "cms" }} /></Box>}
            {canEdit && (picking || !d.path) && <Box sx={{ mt: 1 }}><PagePicker api={api} env={d.env} onEnv={(env) => set({ ...d, env })} onPick={pick} onlyKind="cms" store={d.store} /></Box>}
          </Block>
        </>
      )}

      <Block title="Notes">
        <Field label="For the team" value={d.notes} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, notes: v })} />
      </Block>
    </Box>
  );
}

export function Build({ api, d, set, hits, step, onStep }: {
  api: StudioApi; d: PageDoc; set: (next: PageDoc) => void; hits: ChangeHit[] | null; step: Step; onStep: (s: Step) => void;
}) {
  const canEdit = api.data.access.canEdit;
  const holders = placeholdersOf(d).length;
  const open = unwritten(d).length;
  const steps: { key: Step; label: string }[] = [
    { key: "page", label: "Page" },
    { key: "changes", label: d.changes.length ? `Changes · ${d.changes.length}` : "Changes" },
    { key: "texts", label: holders ? `Texts · ${holders - open}/${holders}` : "Texts" },
    { key: "test", label: d.abTest.enabled ? "A/B test · on" : "A/B test" },
    { key: "publish", label: "Magento" },
  ];
  return (
    <Pane title="Build">
      <Box sx={{ mb: 2.25 }}><Choice value={step} onChange={onStep} options={steps} /></Box>
      {step === "page" && <PageStep api={api} d={d} set={set} canEdit={canEdit} />}
      {step === "changes" && (
        <Block first title={d.source === "new" ? "Its styles and changes" : "The changes"}>
          {d.source === "new" && <Hint mt={0}>The page itself is in Page; here go its styles and any change to the store&apos;s page around it.</Hint>}
          <Box sx={{ mt: d.source === "new" ? 1 : 0 }}><Changes changes={d.changes} set={(changes: Change[]) => set({ ...d, changes })} hits={hits} canEdit={canEdit} /></Box>
        </Block>
      )}
      {step === "texts" && <Block first title="The texts"><Texts d={d} set={set} canEdit={canEdit} /></Block>}
      {step === "test" && <Block first title="The A/B test"><AbTest d={d} set={set} canEdit={canEdit} /></Block>}
      {step === "publish" && <Block first title="To Magento"><Publish api={api} d={d} set={set} canEdit={canEdit} /></Block>}
    </Pane>
  );
}
