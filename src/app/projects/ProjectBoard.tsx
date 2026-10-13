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
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import AddIcon from "@mui/icons-material/Add";
import Assistant from "./Assistant";
import Link from "next/link";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, Kicker } from "@/app/uc/report/ui";
import { CONTENT_BY_KEY } from "@/lib/content/contentTypes";
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

  const general = comments.filter((c) => c.variantId === null);

  return (
    <Box>
      <GlassCard sx={{ mb: 3 }}>
        {/* Who is in it and the way to bring someone in, top right - where
            Adobe Express and every shared-document tool keeps it. */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Typography sx={{ flex: 1, minWidth: 220, fontSize: "1.3rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>
            {project.title}
          </Typography>
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
          </Box>
        </Box>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.25 }}>
          Owner {members.find((m) => m.role === "owner")?.name ?? project.createdBy ?? "somebody"} · started {when(project.createdAt)} ·{" "}
          {variants.length} variation{variants.length === 1 ? "" : "s"}
          {project.chosenVariantId ? " · one chosen" : ""}
        </Typography>
        {project.brief && (
          <Typography sx={{ mt: 1.5, fontSize: "0.88rem", color: MUTED, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {project.brief}
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
      <ShareDialog projectId={id} title={project.title} open={sharing} onClose={() => setSharing(false)} onChanged={load} me={me} />

      {/* Above the versions: it is the thing that can tell you what is wrong
          with them, which is more use than scrolling them yourself. */}
      <Kicker>Assistant</Kicker>
      <Box sx={{ mt: 0.5, mb: 3 }}>
        <Assistant projectId={id} canEdit={access?.canEdit !== false} onApplied={load} />
      </Box>

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
                  title={v.label || type?.label || v.channel}
                  note={`${v.createdBy ?? "somebody"} · ${when(v.createdAt)}${v.language ? ` · ${v.language}` : ""}`}
                  right={access?.canEdit && (
                    <Button
                      size="small"
                      onClick={() => post({ action: "choose", variantId: chosen ? null : v.id })}
                      sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                    >
                      {chosen ? "Unchoose" : "Choose this"}
                    </Button>
                  )}
                />

                <Box
                  sx={{
                    maxHeight: 420, overflowY: "auto", p: 1.5, borderRadius: "12px",
                    bgcolor: "rgba(21,34,58,.03)", fontSize: "0.84rem", color: INK,
                    lineHeight: 1.7, whiteSpace: "pre-wrap",
                  }}
                >
                  {v.body}
                </Box>

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

      <Kicker>The conversation</Kicker>
      <GlassCard sx={{ mt: 0.5 }}>
        <Conversation
          comments={general}
          placeholder="Anything about the project as a whole…"
          onSend={(text) => post({ action: "comment", variantId: null, body: text })}
        />
      </GlassCard>
    </Box>
  );
}
