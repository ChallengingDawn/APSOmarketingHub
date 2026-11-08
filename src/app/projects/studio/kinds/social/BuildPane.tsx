"use client";
// THE POST'S BUILD PANE (08.11.2026): the networks it goes to, its text for each (with where the feed cuts it), LinkedIn's
// first comment, the hashtags, the media (MediaEditor), the link, the day, notes. Every change saves on its own.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

import { Choice } from "@/app/connectors/parts";
import { HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { NETWORK, NETWORKS, cleanTag, enabled, fold, type Network, type SocialDoc } from "@/lib/content/studio/kinds/social/model";
import { Field, PINK, btn, field } from "../../parts";
import { ChipsInput, Hint, Section } from "../banner/ui";
import MediaEditor from "./MediaEditor";

export const NET_ICON: Record<Network, React.ReactNode> = {
  linkedin: <LinkedInIcon sx={{ fontSize: 18 }} />, instagram: <InstagramIcon sx={{ fontSize: 18 }} />, facebook: <FacebookIcon sx={{ fontSize: 18 }} />,
};
export const NET_COLOR: Record<Network, string> = { linkedin: "#0a66c2", instagram: "#d62976", facebook: "#1877f2" };

export type SocialBuildProps = {
  doc: SocialDoc;
  set: (fn: (d: SocialDoc) => SocialDoc) => void;
  canEdit: boolean;
  textNet: Network;
  setTextNet: (n: Network) => void;
  slide: number;
  setSlide: (i: number) => void;
  /** The AI's rewrite of one network's text for another; null when the AI is not there. */
  adapt: ((from: Network, to: Network) => Promise<void>) | null;
  adapting: boolean;
};

function NetworkPills({ doc, set, canEdit, setTextNet }: SocialBuildProps) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {NETWORKS.map((n) => {
        const on = doc.networks[n].on;
        return (
          <Box key={n} component="button" type="button" disabled={!canEdit} aria-pressed={on} onClick={() => {
            const next = !on;
            if (!next && enabled(doc).length === 1) return;
            set((d) => ({ ...d, networks: { ...d.networks, [n]: { ...d.networks[n], on: next } } }));
            if (next) setTextNet(n);
          }} sx={{
            all: "unset", cursor: canEdit ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 0.8, pl: 1, pr: 1.4, py: 0.7,
            borderRadius: "999px", fontSize: "0.84rem", fontWeight: 650, transition: "all .15s",
            border: `1px solid ${on ? NET_COLOR[n] : HAIRLINE}`, color: on ? "#fff" : MUTED, bgcolor: on ? NET_COLOR[n] : "rgba(255,255,255,.7)",
            "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 2 },
          }}>
            {NET_ICON[n]}{NETWORK[n].label}
          </Box>
        );
      })}
    </Box>
  );
}

/** The text of one network, with its two numbers: what the feed shows before its cut, and the whole length. */
function TextFor({ doc, set, canEdit, textNet: n, adapt, adapting }: SocialBuildProps) {
  const p = doc.networks[n];
  const spec = NETWORK[n];
  const f = fold(p.text, n);
  const over = p.text.length > spec.max;
  const others = enabled(doc).filter((x) => x !== n && doc.networks[x].text.trim());
  const put = (patch: Partial<SocialDoc["networks"][Network]>) => set((d) => ({ ...d, networks: { ...d.networks, [n]: { ...d.networks[n], ...patch } } }));
  return (
    <Box>
      <TextField fullWidth multiline minRows={8} value={p.text} disabled={!canEdit} onChange={(e) => put({ text: e.target.value })} sx={field}
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
          {over ? `${(p.text.length - spec.max).toLocaleString("en-GB")} too many` : `${p.text.length.toLocaleString("en-GB")} / ${spec.max.toLocaleString("en-GB")}`}
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

export default function BuildPane(props: SocialBuildProps) {
  const { doc, set, canEdit, textNet, setTextNet } = props;
  const nets = enabled(doc);
  const n = nets.includes(textNet) ? textNet : nets[0];
  const liTags = doc.hashtags.length;
  return (
    <Box>
      <Section first title="Where it goes">
        <NetworkPills {...props} />
      </Section>

      <Section title="Text" right={nets.length > 1 ? (
        <Choice value={n} onChange={setTextNet} options={nets.map((k) => ({ key: k, label: NETWORK[k].label }))} />
      ) : undefined}>
        <TextFor {...props} textNet={n} />
      </Section>

      <Section title="Hashtags">
        <ChipsInput values={doc.hashtags} comma max={30} disabled={!canEdit} placeholder="sealing technology, MRO…" clean={cleanTag}
          onChange={(v) => set((d) => ({ ...d, hashtags: v }))} />
        <Hint sx={{ mt: 0.75 }}>
          {liTags > 5 ? "More than five reads as hashtag soup on LinkedIn." : "Three to five real ones - they go at the end of each post where they are on."}
        </Hint>
      </Section>

      <Section title="Picture">
        <MediaEditor {...props} />
      </Section>

      <Section title="Link">
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 1 }}>
          <Field label="Address" value={doc.link.url} onChange={(v) => set((d) => ({ ...d, link: { ...d.link, url: v.trim() } }))} placeholder="https://www.apsoparts.com/…" disabled={!canEdit} />
          <Field label="Words before it" value={doc.link.label} onChange={(v) => set((d) => ({ ...d, link: { ...d.link, label: v } }))} placeholder="Sizes in the shop:" disabled={!canEdit} />
        </Box>
        {doc.networks.linkedin.on && doc.link.url && (
          <FormControlLabel sx={{ mt: -0.5, "& .MuiFormControlLabel-label": { fontSize: "0.82rem", color: INK } }}
            control={<Switch size="small" checked={doc.link.inComment} disabled={!canEdit} onChange={(e) => set((d) => ({ ...d, link: { ...d.link, inComment: e.target.checked } }))} />}
            label="On LinkedIn, put it in the first comment" />
        )}
        <Hint>{doc.networks.instagram.on ? "Instagram cannot open links in a caption - it goes in the bio. " : ""}It is added to the end of the post where links work.</Hint>
      </Section>

      <Section title="When">
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 1 }}>
          <TextField size="small" type="date" label="Day" value={doc.schedule.date} disabled={!canEdit} sx={field} slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => set((d) => ({ ...d, schedule: { ...d.schedule, date: e.target.value } }))} />
          <TextField size="small" type="time" label="Time" value={doc.schedule.time} disabled={!canEdit} sx={field} slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => set((d) => ({ ...d, schedule: { ...d.schedule, time: e.target.value } }))} />
        </Box>
        <Hint sx={{ mt: 0.75 }}>For whoever posts it - nothing is scheduled from the hub.</Hint>
      </Section>

      <Section title="Notes">
        <Field label="For the team" value={doc.notes} onChange={(v) => set((d) => ({ ...d, notes: v }))} multiline rows={3} disabled={!canEdit} />
      </Section>
    </Box>
  );
}
