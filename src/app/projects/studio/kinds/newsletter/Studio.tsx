"use client";
// THE NEWSLETTER STUDIO (SARCLA 08.11.2026: "newsletter - learn from our newsletters in HS and here you should be able to
// build our newsletter, push to HubSpot, plan to send; everything on the content calendar"; then, the same day: "the
// newsletter should be much more improved, with the assistant on the side; pictures are not being generated; also here I
// should be able to push it into the content calendar").
//
//   build      the envelope with its send day (= the to-do's day on the content calendar, the same as the bar's), the
//              layouts, the blocks (drag, insert between, duplicate, a gallery of types), each picture made or uploaded
//   preview    the real e-mail HTML at 600 px, on a phone, or as the inbox shows it; a click on a block picks it
//   assistant  write it all from the brief, subject lines, rewrite / shorten / make personal / translate a block or the
//              whole letter, a free ask - every change listed with its Undo; then copy, download, or a HubSpot draft

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TranslateIcon from "@mui/icons-material/Translate";
import UndoIcon from "@mui/icons-material/Undo";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOCK_LABEL, TEMPLATES, applyDraft, applyEdits, applyTemplate, asNewsletter, checks, hubPictures, isBlank, renderEmail,
  type DraftAnswer, type Edits, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { AssistantPanel, Label, Pane, StudioPanes, btn, mainBtn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import { setDocSafely } from "../blog/safeSet";
import { BLUE, Frame, toolBtn, useSettled, type Device } from "../blog/ui";
import { BuildPane } from "./Blocks";
import { OurEmails, type Learned } from "./OurEmails";

const LANGS: { key: string; label: string }[] = [{ key: "DE", label: "German" }, { key: "FR", label: "French" }, { key: "IT", label: "Italian" }, { key: "EN", label: "English" }, { key: "NL", label: "Dutch" }, { key: "PL", label: "Polish" }];

type Change = { id: number; text: string; before: NewsletterDoc; at: string };
type EditAnswer = Edits & { note: string };

/** The e-mail as an inbox shows it: who, the subject, the preheader. */
function Inbox({ d, device }: { d: NewsletterDoc; device: Device }) {
  const rows = [
    { from: d.fromName || "APSOparts", subject: d.subject || "(no subject yet)", pre: d.preheader || "(no preheader - the first words of the e-mail show)", mine: true, time: "08:00" },
    { from: "Your supplier", subject: "Order confirmation 4711", pre: "Thank you for your order…", mine: false, time: "Yesterday" },
    { from: "Team calendar", subject: "Weekly planning", pre: "Agenda for Monday…", mine: false, time: "Mon" },
  ];
  return (
    <Box sx={{ maxWidth: device === "mobile" ? 390 : 760, mx: "auto", bgcolor: "#fff", borderRadius: device === "mobile" ? "22px" : "8px", overflow: "hidden", boxShadow: "0 18px 50px rgba(31,45,78,.14)", border: device === "mobile" ? "8px solid #15223a" : "none" }}>
      {rows.map((r, i) => (
        <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", px: 2, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: r.mine ? "#f6f9ff" : "#fff" }}>
          <Box sx={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, bgcolor: r.mine ? "#d80901" : "#c9d1d6", color: "#fff", display: "grid", placeItems: "center", fontSize: "0.8rem", fontWeight: 700 }}>{r.from[0]}</Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Typography sx={{ flex: 1, fontSize: "0.9rem", fontWeight: r.mine ? 700 : 500, color: INK }}>{r.from}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{r.time}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: r.mine ? 700 : 500, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subject}</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.pre}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function Studio({ api }: StudioProps) {
  const d = useMemo(() => asNewsletter(api.doc), [api.doc]);
  const canEdit = api.data.access.canEdit;
  const [open, setOpen] = useState<string | null>(d.blocks.find((b) => b.kind === "hero")?.id ?? null);
  const [view, setView] = useState<"email" | "inbox">("email");
  const [device, setDevice] = useState<Device>("desktop");
  const [subjects, setSubjects] = useState<{ subject: string; preheader: string; why: string }[] | null>(null);
  const [learned, setLearned] = useState<Learned | null>(null);
  const [ours, setOurs] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [scope, setScope] = useState<"block" | "all">("block");
  const [lang, setLang] = useState(() => (d.language.toUpperCase() === "EN" ? "DE" : "EN"));
  const [translating, setTranslating] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const docRef = useRef(d);
  docRef.current = d;
  const frameDoc = useRef<Document | null>(null);

  const set = (next: NewsletterDoc) => api.setDoc(next);
  const issues = useMemo(() => checks(d), [d]);
  const blank = useMemo(() => isBlank(d), [d]);
  const settled = useSettled(d, 300);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const html = useMemo(() => renderEmail(settled, { preview: true, origin }), [settled, origin]);
  const selected = d.blocks.find((b) => b.id === open) ?? null;

  /** A change by the assistant (or a layout): laid over the newsletter as it is now, listed with its Undo. */
  const apply = async (next: NewsletterDoc, text: string) => {
    const before = docRef.current;
    await setDocSafely(api, before, next);
    setChanges((c) => [{ id: Date.now(), text, before, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }, ...c].slice(0, 12));
  };
  const undo = async (ch: Change) => {
    await setDocSafely(api, docRef.current, ch.before);
    setChanges((c) => c.filter((x) => x.id > ch.id ? false : x.id !== ch.id));
  };

  // a click on a block in the preview picks it here; the picked one is outlined there
  const onDoc = useCallback((doc: Document) => {
    frameDoc.current = doc;
    doc.querySelectorAll<HTMLElement>("[data-block]").forEach((el) => {
      el.onclick = () => {
        const id = el.getAttribute("data-block");
        setOpen(id);
        if (id) setTimeout(() => document.getElementById(`nl-block-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
      };
    });
    doc.querySelectorAll(".blk.sel").forEach((x) => x.classList.remove("sel"));
    if (open) doc.querySelector(`[data-block="${CSS.escape(open)}"]`)?.classList.add("sel");
  }, [open]);
  useEffect(() => {
    const doc = frameDoc.current;
    if (!doc) return;
    doc.querySelectorAll(".blk.sel").forEach((x) => x.classList.remove("sel"));
    if (open) doc.querySelector(`[data-block="${CSS.escape(open)}"]`)?.classList.add("sel");
  }, [open, html]);

  // what the assistant knows of our e-mails: subject and figures - and, for the ones picked, their words
  const learnedText = (learned?.newsletters?.map((n) => `${n.subject} - ${n.opens} - ${n.clicks}${n.words ? `\n${n.words}` : ""}`).join("\n\n") ?? "").slice(0, 3000);

  const draft = async (request: string): Promise<string | null> => {
    const r = await api.ai<DraftAnswer>("draft", { learned: learnedText, request });
    if (!r.ok) return r.error;
    await apply(applyDraft(docRef.current, r.result), `The whole newsletter: subject, preheader, lead story and ${r.result.stories.length} stories - with an idea for each picture.`);
    setOpen(docRef.current.blocks.find((b) => b.kind === "hero")?.id ?? null);
    return null;
  };
  /** Words changed by the assistant: in one block (the picked one) or in the whole letter. */
  const edit = async (request: string, o: { block?: boolean; language?: string; label: string }): Promise<string | null> => {
    const blockId = o.block ? open ?? undefined : undefined;
    if (o.block && !blockId) return "Pick a block first - in the list or by clicking it in the preview.";
    const r = await api.ai<EditAnswer>("edit", { request, ...(blockId ? { blockId } : {}), ...(o.language ? { language: o.language } : {}) });
    if (!r.ok) return r.error;
    if (!r.result.blocks.length && !r.result.subject && !r.result.preheader) return "Nothing came back to change - ask again, in other words.";
    const next = applyEdits(docRef.current, r.result);
    await apply(o.language ? { ...next, language: o.language } : next, `${o.label}${blockId && selected ? ` - ${BLOCK_LABEL[selected.kind]}` : ""}${r.result.note ? `: ${r.result.note}` : ""}`);
    return null;
  };
  const onBlock = scope === "block" && !!selected;

  const quick: QuickAsk[] = [
    {
      label: blank ? "Write it all from the brief" : "Write it all again",
      run: async () => {
        if (!blank && !window.confirm("Write the whole newsletter again? Its words are replaced - Undo brings them back; pictures stay.")) return null;
        return draft("");
      },
    },
    {
      label: "Five subject lines",
      run: async () => {
        const r = await api.ai<{ subject: string; preheader: string; why: string }[]>("subjects");
        if (!r.ok) return r.error;
        setSubjects(r.result);
        return null;
      },
    },
    { label: selected ? `Rewrite this ${BLOCK_LABEL[selected.kind].toLowerCase()}` : "Rewrite a block (pick one)", run: () => edit("Rewrite it: clearer, more concrete, same facts and links.", { block: true, label: "Rewritten" }) },
    { label: onBlock && selected ? `Shorter - this ${BLOCK_LABEL[selected.kind].toLowerCase()}` : "Shorter - the whole letter", run: () => edit("Make it about a third shorter: keep every fact, cut padding and repetition.", { block: onBlock, label: "Shorter" }) },
    {
      label: onBlock && selected ? `More personal - this ${BLOCK_LABEL[selected.kind].toLowerCase()}` : "More personal - the whole letter",
      run: () => edit("Make it more personal: speak to the reader directly (the language's polite form for business), as one practical person to another, about their day at work; keep every fact.", { block: onBlock, label: "More personal" }),
    },
  ];

  const ask = async (text: string) => (blank ? draft(text) : edit(text, { block: onBlock, label: "As asked" }));

  const getHtml = async () => {
    const r = await api.act<{ html: string }>("html");
    return r.ok ? r.result.html : null;
  };
  const hub = hubPictures(d).length;

  const preview = (
    <Pane tone="stage" pad={false} title="Preview" right={
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <SquareChoice value={view} onChange={setView} options={[{ key: "email", label: "The e-mail" }, { key: "inbox", label: "In the inbox" }]} />
        <SquareChoice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />
      </Box>
    }>
      <Box sx={{ p: 3 }}>
        {view === "email"
          ? <Frame html={html} device={device} width={680} title="The e-mail" onDoc={onDoc} />
          : <Inbox d={d} device={device} />}
      </Box>
    </Pane>
  );

  const assist = (
    <AssistantPanel enabled={api.data.ai && canEdit} quick={quick} onAsk={ask}
      placeholder={blank ? "Say what this newsletter should say" : onBlock ? "Ask for a change to the picked block - e.g. for buyers, not engineers" : "Ask for a change to the whole letter"}>
      {selected && !blank && (
        <Box sx={{ mt: 1.25 }}>
          <SquareChoice label="Asks work on" value={scope} onChange={setScope} options={[{ key: "block", label: `This ${BLOCK_LABEL[selected.kind].toLowerCase()}` }, { key: "all", label: "The whole letter" }]} />
        </Box>
      )}

      <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
        <Label mt={0}>Translate the whole letter</Label>
        <SquareChoice value={lang} onChange={setLang} options={LANGS.filter((l) => l.key !== d.language.toUpperCase()).map((l) => ({ key: l.key, label: l.key }))} />
        <Button fullWidth variant="outlined" disabled={!api.data.ai || !canEdit || translating || blank} startIcon={<TranslateIcon sx={{ fontSize: 17 }} />}
          onClick={async () => { setTranslating(true); setNote(await edit("Translate every word of the newsletter faithfully.", { language: lang, label: `Into ${LANGS.find((l) => l.key === lang)?.label}` })); setTranslating(false); }}
          sx={{ ...btn, mt: 1, justifyContent: "flex-start", borderColor: HAIRLINE, color: INK, bgcolor: "#fff", "&:hover": { borderColor: BLUE, bgcolor: "#fff" } }}>
          {translating ? `Translating into ${LANGS.find((l) => l.key === lang)?.label}…` : `Into ${LANGS.find((l) => l.key === lang)?.label}`}
        </Button>
      </Box>

      {changes.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>What the assistant changed</Label>
          {changes.map((ch, i) => (
            <Box key={ch.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1.25, mb: 0.75, borderRadius: "6px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45 }}>{ch.text}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{ch.at}</Typography>
              </Box>
              <Tooltip title={i === 0 ? "Undo this change" : "Back to before this change (the later ones go too)"}>
                <Button size="small" onClick={() => void undo(ch)} startIcon={<UndoIcon sx={{ fontSize: 15 }} />} sx={toolBtn}>Undo</Button>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      {subjects && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>Subject lines - click one to use it</Label>
          {subjects.map((x, i) => (
            <Box key={i} component="button" type="button" onClick={() => void apply({ ...docRef.current, subject: x.subject, preheader: x.preheader }, `Subject: “${x.subject}”`)}
              sx={{ display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", p: 1.25, mb: 0.75, borderRadius: "6px", border: `1px solid ${d.subject === x.subject ? BLUE : HAIRLINE}`, bgcolor: "#fff", "&:hover": { borderColor: BLUE } }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }}>{x.subject}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{x.preheader}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: "#3d4a63", mt: 0.4 }}>{x.why}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
        <Label mt={0}>Our e-mails</Label>
        {d.startedFrom && (
          <Typography sx={{ fontSize: "0.8rem", color: INK, mb: 0.75 }}>
            Started from <b>“{d.startedFrom.subject}”</b>{d.startedFrom.date ? ` (${d.startedFrom.date})` : ""} - its look is the one a HubSpot draft copies.
          </Typography>
        )}
        {learned?.newsletters && learned.newsletters.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>{learned.picked ? "The assistant writes like these:" : "Our last ones, and how they did:"}</Typography>
            {learned.newsletters.map((n, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
                <Box sx={{ flex: 1, minWidth: 0, color: INK }}>{n.subject}</Box><Box sx={{ color: MUTED, whiteSpace: "nowrap" }}>{n.opens} · {n.clicks}</Box>
              </Box>
            ))}
          </Box>
        )}
        {learned && learned.from !== "hubspot" && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1 }}>HubSpot did not let the hub read them ({learned.why}). The assistant writes from our two best letters in the brand brain meanwhile.</Typography>}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <Button size="small" variant="outlined" disabled={!canEdit} onClick={() => setOurs(true)} sx={{ ...toolBtn, height: 34 }}>Look at them</Button>
          <Button size="small" variant="outlined" disabled={!canEdit} sx={{ ...toolBtn, height: 34 }}
            onClick={async () => { const r = await api.act<Learned>("learn"); if (r.ok) setLearned(r.result); else setNote(r.error); }}>How the last did</Button>
        </Box>
      </Box>

      <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 1 }}>
        <Label mt={0}>Send it out</Label>
        {hub > 0 && (
          <Typography sx={{ fontSize: "0.78rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "6px" }}>
            {hub === 1 ? "One picture is" : `${hub} pictures are`} kept in the hub. The e-mail carries the hub&apos;s address for {hub === 1 ? "it" : "them"}; readers only see {hub === 1 ? "it" : "them"} once that address is public - or put {hub === 1 ? "it" : "them"} in HubSpot&apos;s files and swap the address.
          </Typography>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} sx={{ ...toolBtn, height: 36 }}
            onClick={async () => { const h = await getHtml(); if (h) { await navigator.clipboard.writeText(h); setNote("The HTML is copied."); } }}>Copy HTML</Button>
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} sx={{ ...toolBtn, height: 36 }}
            onClick={async () => {
              const h = await getHtml();
              if (!h) return;
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([h], { type: "text/html" }));
              a.download = `${(d.subject || api.data.piece.title).replace(/[^\w-]+/g, "-").slice(0, 60) || "newsletter"}.html`;
              a.click();
            }}>Download</Button>
        </Box>
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
            set({ ...docRef.current, hubspot: { emailId: r.result.emailId ?? undefined, url: r.result.url ?? undefined, state: "draft", at: new Date().toISOString() } });
            setNote(r.result.note ?? "The draft is in HubSpot.");
          }}>Send the draft</Button>
        </DialogActions>
      </Dialog>
      <OurEmails api={api} open={ours} onClose={() => setOurs(false)} language={d.language}
        onStart={(r) => {
          if (!blank && !window.confirm(`Start from “${r.subject}”? Its stories, pictures and buttons replace this newsletter's - Undo brings them back.`)) return;
          void apply({ ...docRef.current, subject: r.subject, preheader: r.preheader, language: r.language || docRef.current.language, blocks: r.blocks as NewsletterDoc["blocks"], startedFrom: r.startedFrom, layout: undefined },
            `Started from our e-mail “${r.subject}” - its stories, pictures and buttons.`);
          setOpen(null);
        }}
        onLearn={(l, picked) => { setLearned(l); set({ ...docRef.current, learnFrom: picked }); }} />
    </AssistantPanel>
  );

  return (
    <StudioPanes id="newsletter" buildWidth={420} assistWidth={340}
      build={<BuildPane api={api} d={d} set={set} open={open} onOpen={setOpen} issues={issues} blank={blank} onOurEmails={canEdit ? () => setOurs(true) : undefined}
        onLayout={(key) => void apply(applyTemplate(docRef.current, key), `Layout: ${TEMPLATES.find((t) => t.key === key)?.name ?? key} - the words already written are kept.`)} />}
      preview={preview}
      assist={assist}
    />
  );
}
