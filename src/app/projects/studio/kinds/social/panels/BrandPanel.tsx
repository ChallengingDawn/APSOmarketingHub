"use client";
// BRAND (SARCLA 08.11.2026: "Brand should have the logo visible like a gallery"). The APSOparts logo in each of its
// versions, each on the ground it is made for, and the logos added to the hub - a click puts it in the corner you chose
// (the one there makes way). Then the brand's colours (on what is selected, or the page) and its type.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { FUTURA_STACK } from "@/app/editor/richKonva";
import type { DesignNode } from "@/lib/design-document";
import { boxAt, type Position } from "@/lib/content/studio/kinds/social/canvasAi";
import { C, LOGOS, type LogoKey } from "@/lib/content/studio/kinds/social/design";
import { PicturePanel, PictureGrid, usePictures, type Picture } from "../../../pictures";
import { Head, Note, PanelFrame, Swatch, T, Tile } from "../look";
import { boardOf, placeLogo } from "../actions";
import type { StudioCtx } from "../Studio";

const NAMED: { c: string; name: string }[] = [
  { c: C.red, name: "APSOparts red" }, { c: C.petrol, name: "Petrol" }, { c: C.ink, name: "Ink" }, { c: C.mute, name: "Slate" },
  { c: C.light, name: "Light grey" }, { c: C.pale, name: "Pale petrol" }, { c: C.white, name: "White" }, { c: C.petrolDeep, name: "Deep petrol" },
];

const LOGO_ORDER: LogoKey[] = ["black", "colour", "white", "companyColour", "companyWhite"];

export default function BrandPanel({ ctx }: { ctx: StudioCtx }) {
  const [pos, setPos] = useState<Position>("top-left");
  const [adding, setAdding] = useState(false);
  const uploaded = usePictures("logos");
  const c = ctx.canvas.current;
  const selected = (ctx.live?.nodes ?? []).filter((n) => ctx.selection.includes(n.id));

  const ownLogo = (p: Picture) => {
    if (!c || !ctx.canEdit) return;
    const s = boardOf(ctx);
    const w = Math.round(s.w * 0.2);
    const h = p.width && p.height ? Math.round((w * p.height) / p.width) : Math.round(w * 0.35);
    const at = boxAt(pos, s, w, h);
    const id = `logo${Date.now().toString(36)}`;
    c.commit((nodes) => [...nodes, { id, kind: "image", x: at.x, y: at.y, width: w, height: h, fill: "#fff", src: p.url, opacity: 1 } as DesignNode]);
    c.select([id]);
  };
  const colour = (col: string) => {
    if (!c || !ctx.canEdit) return;
    const ids = new Set(ctx.selection);
    const paintable = selected.filter((n) => n.kind === "text" || n.kind === "rect" || n.kind === "ellipse" || n.kind === "arrow");
    if (paintable.length) c.commit((nodes) => nodes.map((n) => (ids.has(n.id) && paintable.some((p) => p.id === n.id) ? { ...n, fill: col, ...(n.kind === "arrow" ? { stroke: col } : {}), gradient: undefined } : n)));
    else c.setBackground({ color: col, gradientId: null, src: null });
  };
  const font = (weight: "700" | "500") => {
    if (!c || !ctx.canEdit) return;
    const ids = new Set(selected.filter((n) => n.kind === "text").map((n) => n.id));
    if (!ids.size) return;
    c.commit((nodes) => nodes.map((n) => (ids.has(n.id) ? { ...n, fontKey: "futura", fontStyle: weight, letterSpacing: weight === "700" ? -0.01 * (n.fontSize ?? 24) : 0 } : n)));
  };
  const texts = selected.some((n) => n.kind === "text");

  return (
    <PanelFrame title="Brand">
      <Head mt={0.5}>Logos</Head>
      <Box sx={{ mb: 1.25 }}>
        <SquareChoice value={pos} onChange={setPos} options={[{ key: "top-left", label: "Top left" }, { key: "top-right", label: "Top right" }, { key: "bottom-left", label: "Bottom left" }, { key: "bottom-right", label: "Bottom right" }]} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        {LOGO_ORDER.map((k) => {
          const l = LOGOS[k];
          const wide = k.startsWith("company");
          return (
            <Box key={k} sx={{ gridColumn: wide ? "1 / -1" : undefined }}>
              <Tile onClick={() => placeLogo(ctx, k, pos)} disabled={!ctx.canEdit} title={`Put the ${l.label.toLowerCase()} logo ${pos.replace("-", " ")}`}
                sx={{ height: wide ? 70 : 84, display: "grid", placeItems: "center", bgcolor: l.dark ? C.petrol : k === "black" ? C.light : "#fff", borderColor: l.dark ? C.petrol : T.line }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt={`APSOparts logo, ${l.label}`} style={{ maxWidth: wide ? "84%" : "74%", maxHeight: wide ? 44 : 40, display: "block" }} />
              </Tile>
              <Typography sx={{ mt: 0.5, fontSize: "0.72rem", color: T.ink3 }}>{l.label}</Typography>
            </Box>
          );
        })}
      </Box>

      <Head right={<Box component="button" type="button" onClick={() => setAdding((a) => !a)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.76rem", fontWeight: 700, color: T.accent }}>{adding ? "Done" : "Add a logo"}</Box>}>Logos in the hub</Head>
      {adding
        ? <PicturePanel onPick={(p) => { uploaded.add(p); setAdding(false); }} projectId={ctx.api.data.piece.projectId} pieceId={ctx.api.data.piece.id} me={ctx.api.data.me} tabs={["logos"]} start="logos" columns={3} />
        : <PictureGrid pictures={uploaded.pictures} onPick={ownLogo} columns={3} empty="No other logo yet - a partner's, a fair's: add it here." />}

      <Head>Colours</Head>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.25 }}>
        {NAMED.map((x) => (
          <Box key={x.c} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
            <Swatch color={x.c} size={44} onClick={() => colour(x.c)} title={`${x.name} ${x.c}`} />
            <Typography sx={{ fontSize: "0.68rem", color: T.ink3, textAlign: "center", lineHeight: 1.2 }}>{x.name}</Typography>
          </Box>
        ))}
      </Box>
      <Note sx={{ mt: 1 }}>{selected.length ? "A click colours what is selected." : "A click colours the page - select something to colour it instead."}</Note>

      <Head>Type</Head>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        <Tile onClick={() => font("700")} disabled={!texts} title={texts ? "Set the selected text in Futura bold" : "Select a text first"} sx={{ px: 1.75, py: 1.25 }}>
          <Box sx={{ font: `700 24px/1.1 ${FUTURA_STACK}`, color: C.ink, letterSpacing: "-0.01em" }}>Futura <span style={{ color: C.red }}>bold</span></Box>
          <Typography sx={{ fontSize: "0.72rem", color: T.ink3, mt: 0.25 }}>Headlines, numbers, buttons</Typography>
        </Tile>
        <Tile onClick={() => font("500")} disabled={!texts} title={texts ? "Set the selected text in Futura" : "Select a text first"} sx={{ px: 1.75, py: 1.25 }}>
          <Box sx={{ font: `500 18px/1.3 ${FUTURA_STACK}`, color: C.ink }}>Futura medium</Box>
          <Typography sx={{ fontSize: "0.72rem", color: T.ink3, mt: 0.25 }}>Kickers, text, captions</Typography>
        </Tile>
      </Box>
      <Note sx={{ mt: 1 }}>The shop sets its type in Futura; the hub draws it with Jost, its free look-alike. Key words go red: *like this*.</Note>
    </PanelFrame>
  );
}
