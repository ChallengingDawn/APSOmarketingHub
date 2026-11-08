"use client";
// THE POST AS ITS FEED SHOWS IT (08.11.2026): a LinkedIn post (with its "…see more" cut, its picture, card or document
// carousel with the page counter, its first comment), an Instagram post (square, carousel dots, caption cut at 125),
// a Facebook post. The slides are drawn by the same code as their PNGs. No made-up numbers: no likes, no followers.

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PublicIcon from "@mui/icons-material/Public";
import RepeatIcon from "@mui/icons-material/Repeat";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";

import { Choice } from "@/app/connectors/parts";
import { MUTED } from "@/app/uc/report/ui";
import { BRAND, logoSvg, mediaUrl } from "@/lib/content/studio/kinds/banner/brand";
import { CARD_SIZE, NETWORK, SLIDE_SIZE, composed, composedComment, enabled, fold, slidesOf, type Network, type SocialDoc } from "@/lib/content/studio/kinds/social/model";
import { slideCss, slideHtml } from "@/lib/content/studio/kinds/social/slides";
import { Pane } from "../../parts";
import { Scaled, useWidth } from "../banner/ui";

const UI_FONT = `-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const WIDTH: Record<Network, number> = { linkedin: 552, instagram: 468, facebook: 500 };

function Avatar({ size, round }: { size: number; round?: boolean }) {
  return (
    <Box sx={{ width: size, height: size, flexShrink: 0, borderRadius: round ? "50%" : "6px", bgcolor: "#fff", border: "1px solid rgba(0,0,0,.08)", display: "grid", placeItems: "center", overflow: "hidden", "& svg": { width: "84%", height: "auto" } }}
      dangerouslySetInnerHTML={{ __html: logoSvg("av", BRAND.red) }} />
  );
}

/** A post's words with the feed's cut; hashtags and links in the network's link colour. */
function PostText({ text, net, lead }: { text: string; net: Network; lead?: string }) {
  const [open, setOpen] = useState(false);
  const f = fold(text, net);
  const link = net === "linkedin" ? "#0a66c2" : net === "instagram" ? "#00376b" : "#385898";
  const paint = (s: string) => s.split(/(#[\p{L}\p{N}_]+|https?:\/\/\S+)/u).map((part, i) =>
    /^#|^https?:/.test(part) ? <Box key={i} component="span" sx={{ color: link, fontWeight: net === "linkedin" ? 600 : 400 }}>{part}</Box> : part);
  if (!text.trim()) return <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, color: "#8a8d91", fontStyle: "italic" }}>No text yet.</Typography>;
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

/** The post's picture, card or carousel at the feed's width. */
function PostMedia({ doc, net, width, at, setAt, prefix }: { doc: SocialDoc; net: Network; width: number; at: number; setAt: (i: number) => void; prefix: string }) {
  const m = doc.media;
  if (m.kind === "image") {
    const url = mediaUrl(m.image.url);
    if (!url || !url.startsWith("https://www.apsoparts.com/")) {
      return <Box sx={{ height: width * 0.6, bgcolor: "#eef1f3", display: "grid", placeItems: "center", color: MUTED, fontSize: 13 }}>{url ? "Only the shop's pictures show here" : "No photo chosen"}</Box>;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={m.image.alt} style={{ display: "block", width: "100%", aspectRatio: net === "instagram" ? "1 / 1" : undefined, objectFit: "cover", maxHeight: net === "instagram" ? undefined : width * 1.25 }} />;
  }
  const slides = slidesOf(doc);
  if (!slides.length) return null;
  const size = m.kind === "card" ? CARD_SIZE[net] : SLIDE_SIZE[m.size];
  const i = Math.min(at, slides.length - 1);
  const html = slideHtml(slides[i], { prefix, w: size.w, h: size.h, index: i, total: slides.length, linkLabel: doc.link.label.replace(/:\s*$/, "") || undefined });
  const many = slides.length > 1;
  const arrow = (dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= slides.length) return null;
    return (
      <IconButton size="small" aria-label={dir < 0 ? "Previous slide" : "Next slide"} onClick={() => setAt(to)} sx={{
        position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 8, transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,.92)", boxShadow: "0 2px 8px rgba(0,0,0,.2)",
        "&:hover": { bgcolor: "#fff" }, width: 30, height: 30,
      }}>{dir < 0 ? <ChevronLeftIcon sx={{ fontSize: 20 }} /> : <ChevronRightIcon sx={{ fontSize: 20 }} />}</IconButton>
    );
  };
  return (
    <Box>
      <Box sx={{ position: "relative", bgcolor: "#f3f2ef" }}>
        <Scaled css={slideCss(prefix)} html={html} w={size.w} h={size.h} scale={width / size.w} shadow={false} />
        {many && arrow(-1)}{many && arrow(1)}
        {many && net !== "linkedin" && (
          <Box sx={{ position: "absolute", top: 12, right: 12, px: 1, py: 0.25, borderRadius: "999px", bgcolor: "rgba(18,18,18,.7)", color: "#fff", fontFamily: UI_FONT, fontSize: 12, fontWeight: 600 }}>{i + 1}/{slides.length}</Box>
        )}
      </Box>
      {many && net === "linkedin" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.9, bgcolor: "#1d2226", color: "#fff", fontFamily: UI_FONT, fontSize: 13 }}>
          <Box sx={{ fontWeight: 600 }}>{i + 1} / {slides.length}</Box>
          <Box sx={{ flex: 1, height: 3, borderRadius: 2, bgcolor: "rgba(255,255,255,.25)", overflow: "hidden" }}><Box sx={{ width: `${((i + 1) / slides.length) * 100}%`, height: "100%", bgcolor: "#fff" }} /></Box>
        </Box>
      )}
      {many && net === "instagram" && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: "4px", pt: 1.25 }}>
          {slides.map((_, k) => <Box key={k} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: k === i ? "#0095f6" : "#c7c7c7" }} />)}
        </Box>
      )}
    </Box>
  );
}

function LinkCard({ doc }: { doc: SocialDoc }) {
  let host = "";
  try { host = new URL(doc.link.url).hostname.replace(/^www\./, ""); } catch { return null; }
  return (
    <Box sx={{ mx: 0, borderTop: "1px solid #e0dfdc", bgcolor: "#eef3f8", px: 1.5, py: 1.25, fontFamily: UI_FONT }}>
      <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,.9)" }}>{doc.link.label.replace(/:\s*$/, "") || "The page's own title"}</Typography>
      <Typography sx={{ fontFamily: UI_FONT, fontSize: 12, color: "rgba(0,0,0,.6)" }}>{host} · the page&apos;s own picture shows here</Typography>
    </Box>
  );
}

const Action = ({ icon, label }: { icon: React.ReactNode; label?: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, px: 1, py: 1, color: "rgba(0,0,0,.6)", fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, "& svg": { fontSize: 20 } }}>{icon}{label}</Box>
);

function LinkedInPost(p: { doc: SocialDoc; width: number; at: number; setAt: (i: number) => void; prefix: string }) {
  const { doc } = p;
  const comment = composedComment(doc);
  return (
    <Box sx={{ width: p.width, bgcolor: "#fff", borderRadius: "10px", border: "1px solid #e0dfdc", boxShadow: "0 0 0 1px rgba(0,0,0,.02)", overflow: "hidden" }}>
      <Box sx={{ display: "flex", gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <Avatar size={48} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,.9)", lineHeight: "20px" }}>APSOparts</Typography>
          <Box title="Your follower count shows here" sx={{ mt: "4px", mb: "5px", width: 92, height: 9, borderRadius: 4, bgcolor: "#ebebeb" }} />
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 12, color: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", gap: 0.4 }}>Now · <PublicIcon sx={{ fontSize: 13 }} /></Typography>
        </Box>
        <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, color: "#0a66c2", alignSelf: "flex-start" }}>+ Follow</Typography>
      </Box>
      <Box sx={{ px: 2, pb: 1.25 }}><PostText text={composed(doc, "linkedin")} net="linkedin" /></Box>
      {doc.media.kind === "none" ? (doc.link.url && !doc.link.inComment ? <LinkCard doc={doc} /> : null) : <PostMedia {...p} net="linkedin" />}
      <Box sx={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #e8e8e8", mx: 1.5, mt: 0.5 }}>
        <Action icon={<ThumbUpOffAltIcon />} label="Like" /><Action icon={<ChatBubbleOutlineIcon />} label="Comment" /><Action icon={<RepeatIcon />} label="Repost" /><Action icon={<SendOutlinedIcon />} label="Send" />
      </Box>
      {comment && (
        <Box sx={{ display: "flex", gap: 1, px: 2, pt: 0.5, pb: 1.75 }}>
          <Avatar size={32} />
          <Box sx={{ flex: 1, bgcolor: "#f2f2f2", borderRadius: "0 8px 8px 8px", px: 1.5, py: 1 }}>
            <Typography sx={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,.9)", mb: 0.25 }}>APSOparts <Box component="span" sx={{ fontWeight: 400, color: "rgba(0,0,0,.6)", fontSize: 12 }}>· Author</Box></Typography>
            <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, color: "rgba(0,0,0,.9)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", "& a": { color: "#0a66c2" } }}>{comment}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function InstagramPost(p: { doc: SocialDoc; width: number; at: number; setAt: (i: number) => void; prefix: string }) {
  const { doc } = p;
  return (
    <Box sx={{ width: p.width, bgcolor: "#fff", borderRadius: "8px", border: "1px solid #dbdbdb", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25 }}>
        <Box sx={{ p: "2px", borderRadius: "50%", background: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)" }}><Box sx={{ p: "2px", borderRadius: "50%", bgcolor: "#fff" }}><Avatar size={30} round /></Box></Box>
        <Typography sx={{ flex: 1, fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, color: "#000" }}>APSOparts</Typography>
        <MoreHorizIcon sx={{ fontSize: 20, color: "#000" }} />
      </Box>
      {doc.media.kind === "none" ? (
        <Box sx={{ aspectRatio: "1 / 1", bgcolor: "#fafafa", display: "grid", placeItems: "center", color: "#8e8e8e", fontFamily: UI_FONT, fontSize: 14, borderTop: "1px solid #efefef", borderBottom: "1px solid #efefef" }}>Instagram needs a picture</Box>
      ) : <PostMedia {...p} net="instagram" />}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 1.5, pt: 1.25, color: "#000", "& svg": { fontSize: 25 } }}>
        <FavoriteBorderIcon /><ChatBubbleOutlineIcon sx={{ transform: "scaleX(-1)" }} /><SendOutlinedIcon sx={{ transform: "rotate(-20deg)" }} /><Box sx={{ flex: 1 }} /><BookmarkBorderIcon />
      </Box>
      <Box sx={{ px: 1.5, pt: 1, pb: 1.75 }}><PostText text={composed(doc, "instagram")} net="instagram" lead="APSOparts" /></Box>
    </Box>
  );
}

function FacebookPost(p: { doc: SocialDoc; width: number; at: number; setAt: (i: number) => void; prefix: string }) {
  const { doc } = p;
  return (
    <Box sx={{ width: p.width, bgcolor: "#fff", borderRadius: "8px", boxShadow: "0 1px 2px rgba(0,0,0,.2)", overflow: "hidden" }}>
      <Box sx={{ display: "flex", gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <Avatar size={40} round />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 15, fontWeight: 600, color: "#050505" }}>APSOparts</Typography>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 13, color: "#65676b", display: "flex", alignItems: "center", gap: 0.4 }}>Just now · <PublicIcon sx={{ fontSize: 12 }} /></Typography>
        </Box>
        <MoreHorizIcon sx={{ fontSize: 22, color: "#65676b" }} />
      </Box>
      <Box sx={{ px: 2, pb: 1.5 }}><PostText text={composed(doc, "facebook")} net="facebook" /></Box>
      {doc.media.kind === "none" ? (doc.link.url ? <LinkCard doc={doc} /> : null) : <PostMedia {...p} net="facebook" />}
      <Box sx={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #ced0d4", mx: 2, mt: 1, "& > div": { color: "#65676b" } }}>
        <Action icon={<ThumbUpOffAltIcon />} label="Like" /><Action icon={<ChatBubbleOutlineIcon />} label="Comment" /><Action icon={<ShareOutlinedIcon />} label="Share" />
      </Box>
    </Box>
  );
}

export default function FeedPreview({ doc, net, setNet, slide, setSlide, prefix, font }: {
  doc: SocialDoc; net: Network; setNet: (n: Network) => void; slide: number; setSlide: (i: number) => void; prefix: string; font: string | null;
}) {
  const [box, avail] = useWidth<HTMLDivElement>();
  const nets = enabled(doc);
  const n = nets.includes(net) ? net : nets[0];
  const width = Math.max(280, Math.min(WIDTH[n], (avail || WIDTH[n]) - 48));
  const props = { doc, width, at: slide, setAt: setSlide, prefix };
  return (
    <Pane tone="stage" pad={false} title="In the feed" right={nets.length > 1 ? <Choice value={n} onChange={setNet} options={nets.map((k) => ({ key: k, label: NETWORK[k].label }))} /> : undefined}>
      <Box ref={box} sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
        {font === null ? <Typography sx={{ color: MUTED, fontSize: "0.9rem" }}>Loading the brand&apos;s type…</Typography>
          : n === "linkedin" ? <LinkedInPost {...props} /> : n === "instagram" ? <InstagramPost {...props} /> : <FacebookPost {...props} />}
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "center", maxWidth: width }}>
          As {NETWORK[n].label} shows it - &quot;{NETWORK[n].more.replace(/^…\s?/, "")}&quot; opens the rest.{doc.schedule.date ? ` To post on ${new Date(`${doc.schedule.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${doc.schedule.time ? ` at ${doc.schedule.time}` : ""}.` : ""}
        </Typography>
      </Box>
    </Pane>
  );
}
