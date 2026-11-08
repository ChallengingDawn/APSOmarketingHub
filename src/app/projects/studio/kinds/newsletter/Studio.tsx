"use client";
// THE NEWSLETTER STUDIO (SARCLA 08.11.2026: "newsletter - learn from our newsletters in HS and here you should be able to
// build our newsletter, push to HubSpot, plan to send; everything on the content calendar").
//
//   build      the envelope (from, subject, preheader, send date = the to-do's date, on the calendar) and the blocks
//   preview    the real e-mail HTML at 600 px, on a phone, or as the inbox shows it - what goes out, not a mock
//   assistant  write it from the brief in the words of our best ones, five subject lines, rewrite the block you are on,
//              what our last newsletters did; then copy / download the HTML, or send it to HubSpot as a draft

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import { Choice } from "@/app/connectors/parts";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  BLOCK_LABEL, PREHEADER_MAX, SUBJECT_MAX, applyDraft, asNewsletter, checks, newBlock, renderEmail,
  type Block, type BlockKind, type DraftAnswer, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { AssistantPanel, Field, Label, Pane, PreviewFrame, StudioPanes, btn, field, mainBtn, type Device } from "../../parts";
import type { StudioProps } from "../../registry";

const ADDABLE: BlockKind[] = ["hero", "article", "products", "banner", "text", "cta", "divider", "header", "footer"];

/** One block's fields. */
function BlockFields({ b, set, disabled }: { b: Block; set: (b: Block) => void; disabled: boolean }) {
  // a text field of this block (the union's fields differ per kind; each case below names only its own)
  const f = (k: string) => (v: string) => set({ ...b, [k]: v } as Block);
  switch (b.kind) {
    case "header": return <><Field label="Line beside the logo" value={b.tagline} onChange={f("tagline")} max={40} disabled={disabled} /><Field label="Logo picture (address, optional)" value={b.logoUrl} onChange={f("logoUrl")} disabled={disabled} /></>;
    case "hero": return <>
      <Field label="Eyebrow" value={b.eyebrow} onChange={f("eyebrow")} max={30} disabled={disabled} />
      <Field label="Headline" value={b.headline} onChange={f("headline")} max={70} disabled={disabled} />
      <Field label="Text" value={b.text} onChange={f("text")} multiline rows={4} disabled={disabled} helper="**bold**, [link](https://…), a blank line for a new paragraph" />
      <Field label="Picture (address)" value={b.imageUrl} onChange={f("imageUrl")} disabled={disabled} />
      <Field label="What the picture shows" value={b.imageAlt} onChange={f("imageAlt")} disabled={disabled} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Field label="Button" value={b.button.label} onChange={(v) => set({ ...b, button: { ...b.button, label: v } })} max={28} disabled={disabled} />
        <Field label="Its link" value={b.button.url} onChange={(v) => set({ ...b, button: { ...b.button, url: v } })} disabled={disabled} />
      </Box>
    </>;
    case "article": return <>
      <Field label="Title" value={b.title} onChange={f("title")} max={70} disabled={disabled} />
      <Field label="Text" value={b.text} onChange={f("text")} multiline rows={3} disabled={disabled} />
      <Field label="Picture (address, optional)" value={b.imageUrl} onChange={f("imageUrl")} disabled={disabled} />
      {b.imageUrl && <Field label="What the picture shows" value={b.imageAlt} onChange={f("imageAlt")} disabled={disabled} />}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Field label="Link label" value={b.link.label} onChange={(v) => set({ ...b, link: { ...b.link, label: v } })} max={28} disabled={disabled} />
        <Field label="Its link" value={b.link.url} onChange={(v) => set({ ...b, link: { ...b.link, url: v } })} disabled={disabled} />
      </Box>
    </>;
    case "products": return <>
      <Field label="Title" value={b.title} onChange={f("title")} max={60} disabled={disabled} />
      {b.items.map((x, i) => (
        <Box key={i} sx={{ p: 1.25, mb: 1, borderRadius: "10px", border: `1px solid ${HAIRLINE}` }}>
          <Field label={`Product ${i + 1}`} value={x.name} onChange={(v) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, name: v } : y)) })} disabled={disabled} />
          <Field label="One line" value={x.text} onChange={(v) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, text: v } : y)) })} max={80} disabled={disabled} />
          <Field label="Picture (address)" value={x.imageUrl} onChange={(v) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, imageUrl: v } : y)) })} disabled={disabled} />
          <Field label="Its page on the shop" value={x.url} onChange={(v) => set({ ...b, items: b.items.map((y, j) => (j === i ? { ...y, url: v } : y)) })} disabled={disabled} />
        </Box>
      ))}
    </>;
    case "banner": return <>
      <Field label="Banner picture (address)" value={b.imageUrl} onChange={f("imageUrl")} disabled={disabled} helper="600 px wide - a Banner to-do of this project can make it" />
      <Field label="What it shows" value={b.imageAlt} onChange={f("imageAlt")} disabled={disabled} />
      <Field label="Its link" value={b.url} onChange={f("url")} disabled={disabled} />
    </>;
    case "text": return <Field label="Text" value={b.text} onChange={f("text")} multiline rows={5} disabled={disabled} helper="**bold**, [link](https://…), a blank line for a new paragraph" />;
    case "cta": return <>
      <Field label="Line" value={b.text} onChange={f("text")} max={90} disabled={disabled} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Field label="Button" value={b.button.label} onChange={(v) => set({ ...b, button: { ...b.button, label: v } })} max={28} disabled={disabled} />
        <Field label="Its link" value={b.button.url} onChange={(v) => set({ ...b, button: { ...b.button, url: v } })} disabled={disabled} />
      </Box>
    </>;
    case "divider": return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>A thin line between blocks.</Typography>;
    case "footer": return <Field label="Footer text" value={b.text} onChange={f("text")} multiline rows={3} disabled={disabled} helper="The unsubscribe link is added by HubSpot" />;
  }
}

const summary = (b: Block): string => {
  switch (b.kind) {
    case "hero": return b.headline || "No headline yet";
    case "article": return b.title || "No title yet";
    case "products": return b.title || `${b.items.filter((x) => x.name).length} products`;
    case "text": return b.text.slice(0, 60) || "Empty";
    case "cta": return b.button.label || b.text || "No button yet";
    case "banner": return b.imageUrl ? "A picture" : "No picture yet";
    case "header": return b.tagline;
    case "footer": return "Unsubscribe and address";
    default: return "";
  }
};

/** The e-mail as an inbox shows it: who, the subject, the preheader. */
function Inbox({ d, device }: { d: NewsletterDoc; device: Device }) {
  const rows = [
    { from: d.fromName || "APSOparts", subject: d.subject || "(no subject yet)", pre: d.preheader || "(no preheader - the first words of the e-mail show)", mine: true },
    { from: "Your supplier", subject: "Order confirmation 4711", pre: "Thank you for your order…", mine: false },
    { from: "Team calendar", subject: "Weekly planning", pre: "Agenda for Monday…", mine: false },
  ];
  return (
    <Pane tone="stage" title="As the inbox shows it">
      <Box sx={{ maxWidth: device === "mobile" ? 390 : 760, mx: "auto", bgcolor: "#fff", borderRadius: "14px", overflow: "hidden", boxShadow: "0 18px 50px rgba(31,45,78,.14)" }}>
        {rows.map((r, i) => (
          <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "baseline", px: 2, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: r.mine ? "#f6f9ff" : "#fff", flexWrap: device === "mobile" ? "wrap" : "nowrap" }}>
            <Typography sx={{ width: device === "mobile" ? "100%" : 150, flexShrink: 0, fontSize: "0.9rem", fontWeight: r.mine ? 700 : 500, color: INK }}>{r.from}</Typography>
            <Typography sx={{ fontSize: "0.9rem", color: INK, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: device === "mobile" ? "normal" : "nowrap" }}>
              <b style={{ fontWeight: r.mine ? 700 : 500 }}>{r.subject}</b><span style={{ color: MUTED }}> - {r.pre}</span>
            </Typography>
          </Box>
        ))}
      </Box>
    </Pane>
  );
}

export default function Studio({ api }: StudioProps) {
  const d = useMemo(() => asNewsletter(api.doc), [api.doc]);
  const canEdit = api.data.access.canEdit;
  const [open, setOpen] = useState<string | null>(d.blocks.find((b) => b.kind === "hero")?.id ?? null);
  const [view, setView] = useState<"email" | "inbox">("email");
  const [device, setDevice] = useState<Device>("desktop");
  const [adder, setAdder] = useState<HTMLElement | null>(null);
  const [subjects, setSubjects] = useState<{ subject: string; preheader: string; why: string }[] | null>(null);
  const [learned, setLearned] = useState<{ from: string; newsletters?: { subject: string; date: string; opens: string; clicks: string }[]; why?: string } | null>(null);
  const [due, setDue] = useState(api.data.piece.dueDate ?? "");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const set = (next: NewsletterDoc) => api.setDoc(next);
  const setBlock = (b: Block) => set({ ...d, blocks: d.blocks.map((x) => (x.id === b.id ? b : x)) });
  const moveBlock = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= d.blocks.length) return;
    const blocks = [...d.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    set({ ...d, blocks });
  };
  const html = useMemo(() => renderEmail(d, { preview: true }), [d]);
  const issues = useMemo(() => checks(d), [d]);

  // the send date is the to-do's date - the one the content calendar shows
  const saveDue = async (v: string) => {
    setDue(v);
    await fetch(`/api/content/projects/${api.data.piece.projectId}/work`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "piece-edit", pieceId: api.data.piece.id, dueDate: v || null }) });
  };
  const getHtml = async () => {
    const r = await api.act<{ html: string }>("html");
    return r.ok ? r.result.html : null;
  };
  const learnedText = learned?.newsletters?.map((n) => `${n.subject} - ${n.opens} - ${n.clicks}`).join("\n") ?? "";

  const quick = [
    { label: "Write it from the brief", run: async () => {
      const r = await api.ai<DraftAnswer>("draft", { learned: learnedText });
      if (!r.ok) return r.error;
      set(applyDraft(d, r.result));
      return null;
    } },
    { label: "Five subject lines", run: async () => {
      const r = await api.ai<{ subject: string; preheader: string; why: string }[]>("subjects");
      if (!r.ok) return r.error;
      setSubjects(r.result);
      return null;
    } },
    { label: "What our last newsletters did", run: async () => {
      const r = await api.act<typeof learned>("learn");
      if (!r.ok) return r.error;
      setLearned(r.result);
      return null;
    } },
  ];
  const ask = async (text: string) => {
    const b = d.blocks.find((x) => x.id === open);
    if (b && (b.kind === "hero" || b.kind === "article" || b.kind === "text" || b.kind === "cta")) {
      const r = await api.ai<{ title: string; text: string; button: string }>("rewrite", { blockId: b.id, request: text });
      if (!r.ok) return r.error;
      const x = r.result;
      if (b.kind === "hero") setBlock({ ...b, headline: x.title || b.headline, text: x.text || b.text, button: { ...b.button, label: x.button || b.button.label } });
      else if (b.kind === "article") setBlock({ ...b, title: x.title || b.title, text: x.text || b.text, link: { ...b.link, label: x.button || b.link.label } });
      else if (b.kind === "cta") setBlock({ ...b, text: x.text || b.text, button: { ...b.button, label: x.button || b.button.label } });
      else setBlock({ ...b, text: x.text || b.text });
      return null;
    }
    const r = await api.ai<DraftAnswer>("draft", { request: text, learned: learnedText });
    if (!r.ok) return r.error;
    set(applyDraft(d, r.result));
    return null;
  };

  const build = (
    <Pane title="Build">
      {issues.length > 0 && (
        <Box sx={{ mb: 2, p: 1.25, borderRadius: "12px", bgcolor: "#fff8ec", border: "1px solid #f0d6a8" }}>
          {issues.map((c, i) => (
            <Box key={i} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", fontSize: "0.82rem", color: c.level === "bad" ? "#8f1d1b" : "#7f4f0b", py: 0.25 }}>
              <WarningAmberOutlinedIcon sx={{ fontSize: 16, mt: "1px" }} />{c.text}
            </Box>
          ))}
        </Box>
      )}
      <Label mt={0}>The envelope</Label>
      <Field label="From" value={d.fromName} onChange={(v) => set({ ...d, fromName: v })} max={40} disabled={!canEdit} />
      <Field label="Subject" value={d.subject} onChange={(v) => set({ ...d, subject: v })} max={SUBJECT_MAX} disabled={!canEdit} />
      <Field label="Preheader" value={d.preheader} onChange={(v) => set({ ...d, preheader: v })} max={PREHEADER_MAX} disabled={!canEdit} helper="The line the inbox shows after the subject" />
      <TextField fullWidth size="small" type="date" label="Send date" value={due} onChange={(e) => void saveDue(e.target.value)} disabled={!canEdit}
        slotProps={{ inputLabel: { shrink: true } }} helperText="On the content calendar" sx={{ ...field, mb: 1 }} />

      <Box sx={{ display: "flex", alignItems: "center", mt: 2, mb: 0.75 }}>
        <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>The blocks</Typography>
        {canEdit && <Button size="small" startIcon={<AddIcon />} onClick={(e) => setAdder(e.currentTarget)} sx={btn}>Add a block</Button>}
      </Box>
      <Menu anchorEl={adder} open={!!adder} onClose={() => setAdder(null)}>
        {ADDABLE.map((k) => (
          <MenuItem key={k} onClick={() => {
            setAdder(null);
            const b = newBlock(k);
            const footer = d.blocks.findIndex((x) => x.kind === "footer");
            const blocks = [...d.blocks];
            blocks.splice(footer >= 0 && k !== "footer" ? footer : blocks.length, 0, b);
            set({ ...d, blocks });
            setOpen(b.id);
          }}>{BLOCK_LABEL[k]}</MenuItem>
        ))}
      </Menu>
      {d.blocks.map((b, i) => {
        const isOpen = open === b.id;
        return (
          <Box key={b.id} sx={{ mb: 1, borderRadius: "12px", border: `1px solid ${isOpen ? "#c22c6e66" : HAIRLINE}`, bgcolor: "#fff", transition: "border-color .2s ease, box-shadow .2s ease", boxShadow: isOpen ? "0 6px 18px rgba(31,45,78,.08)" : "none" }}>
            <Box onClick={() => setOpen(isOpen ? null : b.id)} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 1, cursor: "pointer" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{BLOCK_LABEL[b.kind]}</Typography>
                <Typography sx={{ fontSize: "0.88rem", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary(b)}</Typography>
              </Box>
              {canEdit && (
                <Box onClick={(e) => e.stopPropagation()} sx={{ display: "flex" }}>
                  <IconButton size="small" aria-label="Move up" disabled={i === 0} onClick={() => moveBlock(i, -1)}><ArrowUpwardIcon sx={{ fontSize: 17 }} /></IconButton>
                  <IconButton size="small" aria-label="Move down" disabled={i === d.blocks.length - 1} onClick={() => moveBlock(i, 1)}><ArrowDownwardIcon sx={{ fontSize: 17 }} /></IconButton>
                  <IconButton size="small" aria-label="Remove the block" onClick={() => set({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) })}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>
                </Box>
              )}
            </Box>
            {isOpen && <Box sx={{ px: 1.25, pb: 1.25 }}><BlockFields b={b} set={setBlock} disabled={!canEdit} /></Box>}
          </Box>
        );
      })}
    </Pane>
  );

  const preview = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Choice value={view} onChange={setView} options={[{ key: "email", label: "The e-mail" }, { key: "inbox", label: "In the inbox" }]} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {view === "email"
          ? <PreviewFrame html={html} width={680} device={device} onDevice={setDevice} title="The e-mail" background="#f4f6f8" />
          : <Inbox d={d} device={device} />}
      </Box>
    </Box>
  );

  const assist = (
    <AssistantPanel enabled={api.data.ai && canEdit} quick={quick} onAsk={ask}
      placeholder={open ? "Ask for a change to the block you are on - e.g. shorter, more technical, for joiners" : "Say what this newsletter should say"}>
      {subjects && (
        <Box sx={{ mt: 2 }}>
          <Label mt={0}>Subject lines - click one to use it</Label>
          {subjects.map((x, i) => (
            <Box key={i} component="button" type="button" onClick={() => set({ ...d, subject: x.subject, preheader: x.preheader })}
              sx={{ display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", p: 1.25, mb: 0.75, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", "&:hover": { borderColor: "#c22c6e" } }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }}>{x.subject}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{x.preheader}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: "#3d4a63", mt: 0.4 }}>{x.why}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {learned && (
        <Box sx={{ mt: 2 }}>
          <Label mt={0}>{learned.from === "hubspot" ? "Our last newsletters (opens · clicks)" : "Our best newsletters, as the brain keeps them"}</Label>
          {learned.newsletters?.map((n, i) => (
            <Box key={i} sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ flex: 1, minWidth: 0, color: INK }}>{n.subject}</Box><Box sx={{ color: MUTED, whiteSpace: "nowrap" }}>{n.opens} · {n.clicks}</Box>
            </Box>
          ))}
          {learned.from !== "hubspot" && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>HubSpot did not let the hub read them ({learned.why}). The AI writes from our gold examples meanwhile.</Typography>}
        </Box>
      )}
      <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 1 }}>
        <Label mt={0}>Send it out</Label>
        <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} sx={btn}
          onClick={async () => { const h = await getHtml(); if (h) { await navigator.clipboard.writeText(h); setNote("The HTML is copied."); } }}>Copy the HTML</Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} sx={btn}
          onClick={async () => {
            const h = await getHtml();
            if (!h) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([h], { type: "text/html" }));
            a.download = `${(d.subject || api.data.piece.title).replace(/[^\w-]+/g, "-").slice(0, 60) || "newsletter"}.html`;
            a.click();
          }}>Download the HTML</Button>
        <Tooltip title="A draft in HubSpot - a person schedules it there">
          <span><Button fullWidth variant="contained" disableElevation startIcon={<SendOutlinedIcon />} disabled={!canEdit} onClick={() => setSending(true)} sx={mainBtn}>Send to HubSpot as a draft</Button></span>
        </Tooltip>
        {d.hubspot?.url && <Button size="small" href={d.hubspot.url} target="_blank" rel="noreferrer" sx={btn}>Open the draft in HubSpot</Button>}
        {note && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{note}</Typography>}
      </Box>
      <Dialog open={sending} onClose={() => setSending(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Send to HubSpot as a draft?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.9rem", color: INK }}>HubSpot gets a draft e-mail “{d.subject || api.data.piece.title}”. Nothing is sent to anybody: a person checks it and schedules it in HubSpot.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSending(false)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation sx={mainBtn} onClick={async () => {
            setSending(false);
            const r = await api.act<{ done: boolean; why?: string; url?: string; emailId?: string; note?: string }>("hubspot", { confirm: true });
            if (!r.ok) return setNote(r.error);
            if (!r.result.done) return setNote(r.result.why ?? "Not sent.");
            set({ ...d, hubspot: { emailId: r.result.emailId ?? undefined, url: r.result.url ?? undefined, state: "draft", at: new Date().toISOString() } });
            setNote(r.result.note ?? "The draft is in HubSpot.");
          }}>Send the draft</Button>
        </DialogActions>
      </Dialog>
    </AssistantPanel>
  );

  return <StudioPanes build={build} preview={preview} assist={assist} />;
}
