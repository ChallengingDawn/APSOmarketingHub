"use client";
// THE POST'S TEXTS (08.11.2026; SARCLA: "subtitle and generate come to this page [Publish], not in the AI module"). One
// network's caption with where its feed cuts it and its length against the network's limit, "adapt from" another
// network, the hashtags on or off, LinkedIn's first comment; and the caption as the feed shows it.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

import { INK, MUTED, RED } from "@/app/uc/report/ui";
import { NETWORK, composed, enabled, fold, type Network, type SocialDoc } from "@/lib/content/studio/kinds/social/model";
import { Field, PINK, btn, field } from "../../parts";

const UI_FONT = `-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

/** The text of one network, with its two numbers: what the feed shows before its cut, and the whole length. */
export function CaptionFor({ doc, set, canEdit, net: n, adapt, adapting }: {
  doc: SocialDoc; set: (fn: (d: SocialDoc) => SocialDoc) => void; canEdit: boolean; net: Network;
  /** The AI's rewrite of one network's text for another; null when the AI is not there. */
  adapt: ((from: Network, to: Network) => Promise<void>) | null; adapting: boolean;
}) {
  const p = doc.networks[n];
  const spec = NETWORK[n];
  // measured on the post as it goes out - its link and hashtags included - as the feed and the checks see it
  const posted = composed(doc, n);
  const f = fold(posted, n);
  const over = posted.length > spec.max;
  const others = enabled(doc).filter((x) => x !== n && doc.networks[x].text.trim());
  const put = (patch: Partial<SocialDoc["networks"][Network]>) => set((d) => ({ ...d, networks: { ...d.networks, [n]: { ...d.networks[n], ...patch } } }));
  return (
    <Box>
      <TextField fullWidth multiline minRows={7} value={p.text} disabled={!canEdit} onChange={(e) => put({ text: e.target.value })} sx={field}
        placeholder={n === "linkedin" ? "The first line is the hook - it has to work before \"…see more\"." : n === "instagram" ? "The point in the first 125 characters, then the rest." : "Conversational, complete in itself."} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.75, px: 0.25 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#edf0f5", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${Math.min(100, (f.shown.length / spec.fold.chars) * 100)}%`, bgcolor: f.cut ? "#274e64" : "#9fb3c0", transition: "width .2s" }} />
          </Box>
          <Typography sx={{ mt: 0.4, fontSize: "0.74rem", color: MUTED }}>
            {f.cut ? `${f.shown.length} characters show before "${spec.more}"` : p.text ? `All of it shows - no "${spec.more}"` : `"${spec.more}" comes after about ${spec.fold.chars} characters`}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: over ? 700 : 500, color: over ? RED : MUTED, whiteSpace: "nowrap" }}>
          {over ? `${(posted.length - spec.max).toLocaleString("en-GB")} too many` : `${posted.length.toLocaleString("en-GB")} / ${spec.max.toLocaleString("en-GB")}`}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mt: 1 }}>
        {others.slice(0, 2).map((o) => (
          <Box key={o} sx={{ display: "contents" }}>
            {adapt && (
              <Button size="small" disabled={!canEdit || adapting} onClick={() => adapt(o, n)}
                startIcon={adapting ? <CircularProgress size={13} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15, color: PINK }} />}
                sx={{ ...btn, fontSize: "0.78rem", color: INK }}>Adapt from {NETWORK[o].label}</Button>
            )}
            {!p.text.trim() && (
              <Button size="small" disabled={!canEdit} onClick={() => put({ text: doc.networks[o].text })} sx={{ ...btn, fontSize: "0.78rem", color: MUTED }}>Same as {NETWORK[o].label}</Button>
            )}
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <FormControlLabel sx={{ mr: 0, "& .MuiFormControlLabel-label": { fontSize: "0.78rem", color: MUTED } }}
          control={<Switch size="small" checked={p.tags} disabled={!canEdit} onChange={(e) => put({ tags: e.target.checked })} />} label="Hashtags" />
      </Box>
      {n === "linkedin" && (
        <Box sx={{ mt: 1.5 }}>
          <Field label="First comment (optional)" value={doc.firstComment} onChange={(v) => set((d) => ({ ...d, firstComment: v }))} max={1250} multiline rows={2} disabled={!canEdit}
            helper="Posted right after - a detail, a source, or the link." />
        </Box>
      )}
    </Box>
  );
}

/** A post's words with the feed's cut; hashtags and links in the network's link colour. */
export function PostText({ text, net, lead }: { text: string; net: Network; lead?: string }) {
  const [open, setOpen] = useState(false);
  const f = fold(text, net);
  const link = net === "linkedin" ? "#0a66c2" : net === "instagram" ? "#00376b" : "#385898";
  const paint = (s: string) => s.split(/(#[\p{L}\p{N}_]+|https?:\/\/\S+)/u).map((part, i) =>
    /^#|^https?:/.test(part) ? <Box key={i} component="span" sx={{ color: link, fontWeight: net === "linkedin" ? 600 : 400 }}>{part}</Box> : part);
  if (!text.trim()) return <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, color: "#8a8d91", fontStyle: "italic" }}>No text yet - write it in step 2.</Typography>;
  return (
    <Typography component="div" sx={{ fontFamily: UI_FONT, fontSize: net === "facebook" ? 15 : 14, lineHeight: net === "linkedin" ? "20px" : 1.4, color: net === "facebook" ? "#050505" : "rgba(0,0,0,.9)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {lead && <Box component="span" sx={{ fontWeight: 600, mr: 0.6 }}>{lead}</Box>}
      {paint(open || !f.cut ? text : f.shown)}
      {f.cut && !open && (
        <Box component="button" type="button" onClick={() => setOpen(true)} sx={{ all: "unset", cursor: "pointer", color: "rgba(0,0,0,.6)", fontWeight: net === "facebook" ? 600 : 400, ml: 0.25, "&:hover": { textDecoration: "underline" } }}>
          {NETWORK[net].more}
        </Box>
      )}
    </Typography>
  );
}
