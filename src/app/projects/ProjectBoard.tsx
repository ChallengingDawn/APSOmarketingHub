"use client";

/**
 * ONE PROJECT: THE BRIEF, EVERY VARIATION, AND THE ARGUMENT ABOUT THEM.
 *
 * Variations sit side by side rather than in a list, because the question
 * people actually have is "which of these two openings is better" and that is
 * not a question you can answer by scrolling. Each column carries who made it
 * and when, so a disagreement has names in it.
 *
 * Choosing one does not delete the others and does not close the page. The
 * rejected variations ARE the argument for the chosen one — six months later
 * "why is the headline like that" is answered by the two underneath it and
 * the comment that says why they lost.
 */

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import FileCopyOutlinedIcon from "@mui/icons-material/FileCopyOutlined";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import AddIcon from "@mui/icons-material/Add";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import TranslateIcon from "@mui/icons-material/Translate";
import FloatingAssistant from "./FloatingAssistant";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Kicker } from "@/app/uc/report/ui";
import { CONTENT_BY_KEY } from "@/lib/content/contentTypes";
import { LANGUAGES, languageLabel } from "@/lib/content/languages";
import {
  bodyToHtml, markdownFor, pdfLinesFor, plainTextFor, slugFor, wordHtmlFor, type ExportVariant,
} from "@/lib/content/exportVariant";
import ShareDialog, { Face } from "./ShareDialog";

type Variant = {
  id: number; contentType: string | null; channel: string; language: string | null;
  label: string | null; title: string | null; body: string;
  createdBy: string | null; createdAt: string;
};
type Comment = { id: number; variantId: number | null; author: string; body: string; createdAt: string };
type Project = {
  id: number; title: string; brief: string | null; status: string; contentType?: string | null;
  chosenVariantId: number | null; createdBy: string | null; createdAt: string;
  /** "YYYY-MM-DD" or null. Already a string when it leaves the database. */
  dueDate: string | null;
};
type Access = { role: string; canEdit: boolean; canComment: boolean; canShare: boolean };
type Member = { username: string; name: string; role: "owner" | "editor" | "commenter" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Conversation({
  comments, onSend, placeholder,
}: {
  comments: Comment[]; onSend: (text: string) => Promise<void>; placeholder: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      {comments.map((c) => (
        <Box key={c.id} sx={{ py: 1, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
            {c.author} · {when(c.createdAt)}
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {c.body}
          </Typography>
        </Box>
      ))}
      <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
        <TextField
          size="small" fullWidth multiline maxRows={4} placeholder={placeholder}
          value={text} onChange={(e) => setText(e.target.value)}
          sx={{ "& .MuiOutlinedInput-root": { fontSize: 13.5, borderRadius: "10px" } }}
        />
        <Button onClick={send} disabled={busy || !text.trim()}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", flexShrink: 0 }}>
          Send
        </Button>
      </Box>
    </Box>
  );
}

export default function ProjectBoard({ id }: { id: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingBrief, setEditingBrief] = useState(false);
  const [briefDraft, setBriefDraft] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);
  const [exporting, setExporting] = useState<{ id: number; at: HTMLElement } | null>(null);
  const [translating, setTranslating] = useState<{ id: number; at: HTMLElement } | null>(null);
  // Which version is in the middle of a translation. One at a time, by the
  // card rather than globally, so the other versions stay usable.
  const [busyVariant, setBusyVariant] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  // NOT setError: that one is an early return and replaces the whole board.
  // A failed export is a passing remark, not the end of the page.
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const [copying, setCopying] = useState(false);
  const [copyTitle, setCopyTitle] = useState("");
  const [copyDrafts, setCopyDrafts] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/content/projects/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error ?? "Could not load the project.");
        setProject(j.project);
        setVariants(j.variants);
        setComments(j.comments);
        setAccess(j.access ?? null);
        setMembers(j.members ?? []);
        setMe(j.me ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load the project."));
  }, [id]);

  useEffect(load, [load]);

  // Seed the editable fields from the project, but never while somebody is
  // typing in them — a reload landing mid-edit would wipe the sentence.
  useEffect(() => {
    if (project && !editingTitle) setTitleDraft(project.title);
    if (project && !editingBrief) setBriefDraft(project.brief ?? "");
  }, [project, editingTitle, editingBrief]);

  // A DATE from the API is already "YYYY-MM-DD", which is exactly what a date
  // input wants. Nothing here builds a Date out of it: that is how a day
  // becomes the day before in a +02:00 office.
  useEffect(() => {
    setDueDate(project?.dueDate ?? "");
  }, [project?.dueDate]);

  const post = async (payload: Record<string, unknown>) => {
    await fetch(`/api/content/projects/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    load();
  };

  if (error) return <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>{error}</Typography>;
  if (!project) return <Typography sx={{ fontSize: "0.9rem", color: FAINT }}>Opening the project…</Typography>;

  const canEdit = access?.canEdit !== false;
  const archived = project?.status === "archived";
  const general = comments.filter((c) => c.variantId === null);

  const translatingSource = variants.find((v) => v.id === translating?.id) ?? null;

  /** The browser's own download, from a blob we made here. */
  const saveFile = (name: string, mime: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    // Revoked on the next tick, not immediately: Safari has not started
    // reading the blob yet when click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const runExport = async (format: "copy" | "md" | "doc" | "pdf") => {
    const v = variants.find((x) => x.id === exporting?.id);
    setExporting(null);
    if (!v) return;
    const payload: ExportVariant = {
      label: v.label, title: v.title, body: v.body,
      language: v.language, channel: v.channel, createdBy: v.createdBy,
    };
    const stem = slugFor(project.title, v.label ?? v.language);

    if (format === "copy") {
      try {
        await navigator.clipboard.writeText(plainTextFor(payload));
        // A copy with no feedback is indistinguishable from a click that
        // missed, so the icon says so for a moment.
        setCopied(v.id);
        setTimeout(() => setCopied((c) => (c === v.id ? null : c)), 1600);
      } catch {
        setNotice("The browser would not let the hub write to the clipboard.");
      }
      return;
    }
    if (format === "md") return saveFile(`${stem}.md`, "text/markdown", markdownFor(project.title, payload));
    if (format === "doc") {
      return saveFile(`${stem}.doc`, "application/msword", wordHtmlFor(project.title, payload));
    }

    try {
      // Loaded here rather than imported: nobody who never exports a PDF
      // should download the PDF writer to open a project.
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
      const margin = 56;
      const width = doc.internal.pageSize.getWidth() - margin * 2;
      const bottom = doc.internal.pageSize.getHeight() - margin;
      let y = margin;
      for (const line of pdfLinesFor(project.title, payload)) {
        doc.setFont("helvetica", line.bold ? "bold" : "normal");
        doc.setFontSize(line.size);
        y += line.gapBefore;
        // Wrapped by the writer, which knows the real glyph widths.
        for (const row of doc.splitTextToSize(line.text, width) as string[]) {
          if (y > bottom) {
            doc.addPage();
            y = margin;
          }
          doc.text(row, margin, y);
          y += line.size * 1.35;
        }
      }
      doc.save(`${stem}.pdf`);
    } catch {
      setNotice("The PDF could not be made. Markdown and Word still work.");
    }
  };

  const translate = async (code: string) => {
    const vid = translating?.id;
    setTranslating(null);
    if (!vid) return;
    setBusyVariant(vid);
    try {
      const j = await fetch(`/api/content/projects/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "translate", variantId: vid, language: code }),
      }).then((r) => r.json());
      // A failed translation says why. "Nothing happened" after twenty
      // seconds of a spinner is the worst of the possible outcomes.
      if (!j.ok) setNotice(j.error || `The ${languageLabel(code)} version could not be made.`);
      else load();
    } catch {
      setNotice(`The ${languageLabel(code)} version could not be made.`);
    } finally {
      setBusyVariant(null);
    }
  };

  return (
    <Box>
      <GlassCard sx={{ mb: 3 }}>
        {/* Who is in it and the way to bring someone in, top right - where
            Adobe Express and every shared-document tool keeps it. */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          {archived && (
            <Box sx={{
              mb: 1.5, px: 1.5, py: 1, borderRadius: "12px", display: "flex", alignItems: "center", gap: 1,
              bgcolor: "rgba(21,34,58,.05)", border: `1px solid ${HAIRLINE}`,
            }}>
              <ArchiveOutlinedIcon sx={{ fontSize: 17, color: MUTED }} />
              <Typography sx={{ fontSize: "0.82rem", color: MUTED, flex: 1 }}>
                This project is archived. It is all still here, and it is out of the lists.
              </Typography>
            </Box>
          )}
          {editingTitle ? (
          <TextField
            autoFocus
            size="small"
            fullWidth
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              const next = titleDraft.trim();
              // An empty name is a slip, not an instruction. Put the old one
              // back rather than storing "" and leaving an unnamed row.
              if (next && next !== project.title) void post({ action: "rename", title: next });
              else setTitleDraft(project.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setTitleDraft(project.title); setEditingTitle(false); }
            }}
            sx={{ "& .MuiOutlinedInput-root": { fontSize: "1.3rem", fontWeight: 700, color: INK } }}
          />
        ) : (
          <Typography
            onClick={() => canEdit && setEditingTitle(true)}
            title={canEdit ? "Click to rename" : undefined}
            sx={{
              fontSize: "1.3rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em",
              cursor: canEdit ? "text" : "default", borderRadius: "6px",
              "&:hover": canEdit ? { bgcolor: "rgba(21,34,58,.04)" } : {},
            }}
          >
            {project.title}
          </Typography>
        )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box component="button" onClick={() => setSharing(true)} aria-label="People in this project"
              sx={{ display: "flex", border: 0, background: "none", p: 0, cursor: "pointer", "& > *:not(:first-of-type)": { ml: "-8px" } }}>
              {members.slice(0, 5).map((m) => <Face key={m.username} name={m.name} />)}
              {members.length > 5 && <Face name={`+ ${members.length - 5}`} />}
            </Box>
            <Button variant={access?.canShare ? "contained" : "outlined"} disableElevation startIcon={<PersonAddAlt1Icon />}
              onClick={() => setSharing(true)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
              {access?.canShare ? "Share" : "People"}
            </Button>
            <Tooltip title="Start another project from this one">
              <IconButton onClick={() => { setCopyTitle(`${project.title} `); setCopyDrafts(false); setCopying(true); }}>
                <FileCopyOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />
              </IconButton>
            </Tooltip>
            {canEdit && (
              <Tooltip title={archived
                ? "Bring it back, so it shows in the lists again"
                : "Put it away. It stays complete, under Archived."}>
                <IconButton onClick={() => void post({ action: "archive", archived: !archived })}>
                  {archived
                    ? <UnarchiveIcon sx={{ fontSize: 19, color: MUTED }} />
                    : <ArchiveOutlinedIcon sx={{ fontSize: 19, color: FAINT }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Due</Typography>
          <TextField
            type="date"
            size="small"
            value={dueDate}
            disabled={!canEdit}
            onChange={(e) => {
              setDueDate(e.target.value);
              void post({ action: "due", dueDate: e.target.value });
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.82rem" }, width: 165 }}
          />
          {dueDate && canEdit && (
            <Button
              size="small"
              onClick={() => { setDueDate(""); void post({ action: "due", dueDate: "" }); }}
              sx={{ textTransform: "none", borderRadius: "10px", color: MUTED }}
            >
              No date
            </Button>
          )}
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
            {dueDate ? <Link href="/projects/calendar" style={{ color: "inherit" }}>See it on the calendar</Link> : "Give it a date and it appears on the calendar"}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.75 }}>
          Owner {members.find((m) => m.role === "owner")?.name ?? project.createdBy ?? "somebody"} · started {when(project.createdAt)} ·{" "}
          {variants.length} variation{variants.length === 1 ? "" : "s"}
          {project.chosenVariantId ? " · one chosen" : ""}
        </Typography>
        {editingBrief ? (
          <TextField
            autoFocus
            size="small"
            fullWidth
            multiline
            minRows={3}
            placeholder="Who it is for, what it has to do, anything already decided."
            value={briefDraft}
            onChange={(e) => setBriefDraft(e.target.value)}
            onBlur={() => {
              setEditingBrief(false);
              if (briefDraft !== (project.brief ?? "")) void post({ action: "brief", brief: briefDraft });
            }}
            sx={{ mt: 1.5 }}
          />
        ) : (
          <Typography
            onClick={() => canEdit && setEditingBrief(true)}
            title={canEdit ? "Click to edit the brief" : undefined}
            sx={{
              mt: 1.5, fontSize: "0.88rem", lineHeight: 1.65, whiteSpace: "pre-wrap",
              color: project.brief ? MUTED : FAINT,
              cursor: canEdit ? "text" : "default", borderRadius: "6px",
              "&:hover": canEdit ? { bgcolor: "rgba(21,34,58,.04)" } : {},
            }}
          >
            {project.brief || (canEdit ? "Add a brief — the assistant reads it every time it writes." : "")}
          </Typography>
        )}
        {access && !access.canEdit && (
          <Typography sx={{ mt: 1.25, fontSize: "0.8rem", color: MUTED }}>
            You can read and comment on this project. Saving or choosing a variation is for its editors.
          </Typography>
        )}

        {/* The loop this was missing. A project could receive a draft somebody
            had already made in the studio, but it could not start one — so the
            brief sat here and got retyped into an empty box next door.
            Hidden from a commenter: it leads to a studio that cannot save back
            here, and a button that goes somewhere useless is worse than none. */}
        {access?.canEdit !== false && (
          <Button
            component={Link}
            href={`/create?project=${project.id}${project.contentType ? `&type=${project.contentType}` : ""}`}
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            sx={{ mt: 2, textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
          >
            New variation
          </Button>
        )}
      </GlassCard>
      <Snackbar open={!!notice} autoHideDuration={6000} onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="warning" variant="filled" onClose={() => setNotice(null)}
          sx={{ borderRadius: "12px", fontSize: "0.84rem" }}>{notice}</Alert>
      </Snackbar>

      <Menu open={!!exporting} anchorEl={exporting?.at ?? null} onClose={() => setExporting(null)}
        slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 210 } } }}>
        <MenuItem onClick={() => runExport("copy")} sx={{ fontSize: "0.85rem" }}>
          <ListItemText primary="Copy the text" secondary="To paste into the next tool"
            slotProps={{ primary: { fontSize: "0.85rem" }, secondary: { fontSize: "0.72rem" } }} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => runExport("md")} sx={{ fontSize: "0.85rem" }}>
          <ListItemText primary="Markdown (.md)" secondary="For the CMS"
            slotProps={{ primary: { fontSize: "0.85rem" }, secondary: { fontSize: "0.72rem" } }} />
        </MenuItem>
        <MenuItem onClick={() => runExport("doc")} sx={{ fontSize: "0.85rem" }}>
          <ListItemText primary="Word (.doc)" secondary="Opens in Word, with the headings"
            slotProps={{ primary: { fontSize: "0.85rem" }, secondary: { fontSize: "0.72rem" } }} />
        </MenuItem>
        <MenuItem onClick={() => runExport("pdf")} sx={{ fontSize: "0.85rem" }}>
          <ListItemText primary="PDF" secondary="To send to somebody who should not edit it"
            slotProps={{ primary: { fontSize: "0.85rem" }, secondary: { fontSize: "0.72rem" } }} />
        </MenuItem>
      </Menu>

      <Menu open={!!translating} anchorEl={translating?.at ?? null} onClose={() => setTranslating(null)}
        slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 190 } } }}>
        {LANGUAGES.filter((l) => l.code !== (translatingSource?.language ?? "").toUpperCase()).map((l) => (
          <MenuItem key={l.code} onClick={() => void translate(l.code)} sx={{ fontSize: "0.85rem" }}>
            {l.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={copying} onClose={() => setCopying(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: "18px" } }}>
        <DialogContent sx={{ p: 2.5, display: "grid", gap: 1.25 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK }}>Use this again</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
            The brief, the type and the folder come across. The comments and the chosen version do not &mdash;
            nothing has been decided in the new one yet.
          </Typography>
          <TextField
            autoFocus size="small" label="Name" placeholder="e.g. DirectCut landing page, Italy"
            value={copyTitle} onChange={(e) => setCopyTitle(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={copyDrafts} onChange={(e) => setCopyDrafts(e.target.checked)} />}
            label={
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                Bring the {variants.length} version{variants.length === 1 ? "" : "s"} across too, to edit rather than start again
              </Typography>
            }
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setCopying(false)} sx={{ textTransform: "none", borderRadius: "10px" }}>Cancel</Button>
            <Button
              variant="contained" disableElevation disabled={copyBusy || !copyTitle.trim()}
              onClick={async () => {
                setCopyBusy(true);
                try {
                  const j = await fetch("/api/content/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ copyOf: id, title: copyTitle.trim(), withVariants: copyDrafts }),
                  }).then((r) => r.json());
                  // Straight into the copy: the next thing anybody does is
                  // change the brief, and that happens in the new project.
                  if (j.ok && j.project?.id) router.push(`/projects/${j.project.id}`);
                  else setNotice(j.error || "The copy could not be made.");
                } catch {
                  setNotice("The copy could not be made.");
                } finally {
                  setCopyBusy(false);
                  setCopying(false);
                }
              }}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
            >
              {copyBusy ? "Copying\u2026" : "Make the copy"}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <ShareDialog projectId={id} title={project.title} open={sharing} onClose={() => setSharing(false)} onChanged={load} me={me} />

      {/* The assistant is a window now, not a region. It was a panel here, a
          panel on the studio rail and a strip under the brief box, and each
          time it was somewhere SARCLA was not — because there is no one right
          place for it. It floats, it is dragged out of the way, and it opens
          where it was left. */}
      <FloatingAssistant projectId={id} canEdit={access?.canEdit !== false} onApplied={load} />

      <Kicker>Variations</Kicker>
      {variants.length === 0 ? (
        <GlassCard sx={{ mt: 0.5, mb: 3 }}>
          <Typography sx={{ fontSize: "0.88rem", color: MUTED, lineHeight: 1.6 }}>
            Nothing here yet. Open Create Studio, write a draft, and save it into this project —
            then do it again differently. Two variations beside each other are worth more than one
            that somebody has to imagine alternatives to.
          </Typography>
        </GlassCard>
      ) : (
        <Box
          sx={{
            mt: 0.5, mb: 3, display: "grid", gap: 2,
            // Side by side on a wide screen, stacked on a narrow one. Comparing
            // is the whole point, so the columns do not shrink below readable.
            gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(340px, 1fr))" },
          }}
        >
          {variants.map((v) => {
            const chosen = project.chosenVariantId === v.id;
            const type = v.contentType ? CONTENT_BY_KEY[v.contentType] : undefined;
            const mine = comments.filter((c) => c.variantId === v.id);
            return (
              <GlassCard key={v.id} sx={chosen ? { border: "1px solid #1b7a55" } : undefined}>
                <CardTitle
                  icon={chosen ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                  tint={chosen ? "green" : "slate"}
                  title={
                    renaming === v.id ? (
                      <TextField
                        autoFocus
                        size="small"
                        variant="standard"
                        placeholder="Shorter hero, Marc's version…"
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onBlur={() => {
                          setRenaming(null);
                          if (labelDraft.trim() !== (v.label ?? "")) {
                            void post({ action: "label-variant", variantId: v.id, label: labelDraft.trim() });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        sx={{ "& .MuiInput-input": { fontSize: "1.02rem", fontWeight: 600 } }}
                      />
                    ) : (
                      v.label || type?.label || v.channel
                    )
                  }
                  note={`${v.createdBy ?? "somebody"} · ${when(v.createdAt)}${v.language ? ` · ${v.language}` : ""}`}
                  right={canEdit && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                      <Button
                        size="small"
                        onClick={() => post({ action: "choose", variantId: chosen ? null : v.id })}
                        sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                      >
                        {chosen ? "Unchoose" : "Choose this"}
                      </Button>
                      <Tooltip title="Rename this version">
                        <IconButton size="small" onClick={() => { setRenaming(v.id); setLabelDraft(v.label ?? ""); }}>
                          <DriveFileRenameOutlineIcon sx={{ fontSize: 17, color: FAINT }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate it, to try a change without losing this one">
                        <IconButton size="small" onClick={() => post({ action: "duplicate-variant", variantId: v.id })}>
                          <ContentCopyIcon sx={{ fontSize: 16, color: FAINT }} />
                        </IconButton>
                      </Tooltip>
                      {/* "Take out", not "delete". It leaves the project and
                          stays in the library, because removing the wrong one
                          from six near-identical drafts is a question of when,
                          not if. */}
                      <Tooltip title="Export it — copy, Markdown, Word or PDF">
                        <IconButton size="small" onClick={(e) => setExporting({ id: v.id, at: e.currentTarget })}>
                          {copied === v.id
                            ? <CheckCircleIcon sx={{ fontSize: 17, color: "#1b7a55" }} />
                            : <FileDownloadOutlinedIcon sx={{ fontSize: 17, color: FAINT }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Translate it into another language, as a new version beside this one">
                        <IconButton size="small" disabled={busyVariant === v.id}
                          onClick={(e) => setTranslating({ id: v.id, at: e.currentTarget })}>
                          {busyVariant === v.id
                            ? <CircularProgress size={14} sx={{ color: FAINT }} />
                            : <TranslateIcon sx={{ fontSize: 17, color: FAINT }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Take it out of this project — it stays in the library">
                        <IconButton size="small" onClick={() => post({ action: "remove-variant", variantId: v.id })}>
                          <RemoveCircleOutlineIcon sx={{ fontSize: 17, color: FAINT }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                />

                {/* Rendered, not shown as source. A draft read as "## The
                    claim" is a draft nobody can judge: the reader is doing the
                    markdown in their head while deciding whether the words
                    work. bodyToHtml is the export renderer - it ESCAPES first
                    and then applies the studio's own subset, so there is
                    nothing a body could contain that becomes markup. */}
                <Box
                  sx={{
                    maxHeight: 420, overflowY: "auto", p: 1.5, borderRadius: "12px",
                    bgcolor: "rgba(21,34,58,.03)", fontSize: "0.84rem", color: INK,
                    lineHeight: 1.7,
                    "& h1, & h2, & h3, & h4": { fontSize: "0.95rem", fontWeight: 700, margin: "0 0 .4em" },
                    "& p": { margin: "0 0 .7em" },
                    "& ul": { margin: "0 0 .7em", paddingLeft: "1.2em", listStyle: "disc" },
                    "& ol": { margin: "0 0 .7em", paddingLeft: "1.2em", listStyle: "decimal" },
                    "& li": { margin: "0 0 .25em" },
                    "& :last-child": { marginBottom: 0 },
                  }}
                  dangerouslySetInnerHTML={{ __html: bodyToHtml(v.body) }}
                />

                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.74rem", color: FAINT }}>
                    <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
                    {mine.length === 0 ? "No comments on this one" : `${mine.length} on this one`}
                  </Typography>
                  <Conversation
                    comments={mine}
                    placeholder="What works, what does not…"
                    onSend={(text) => post({ action: "comment", variantId: v.id, body: text })}
                  />
                </Box>
              </GlassCard>
            );
          })}
        </Box>
      )}

      {/* The project-wide comment box is gone. With the assistant at the top
          the page had two empty text boxes asking for a sentence, and nothing
          on screen said which one did what. Comments survive where they are
          worth something — under the version they are about, where a remark
          has a subject. Anything already written here is still readable in
          the record; this only stops the page inviting more of it. */}
    </Box>
  );
}
