"use client";
// A NEWSLETTER BLOCK, DRAWN SMALL (Content v2, 08.11.2026): the gallery of block types and the layouts show what each
// one looks like in the e-mail - a picture block as a picture, the facts band in petrol, the button in red - not a word.

import Box from "@mui/material/Box";
import type { Block, BlockKind } from "@/lib/content/studio/kinds/newsletter/model";

const RED = "#d80901";
const PETROL = "#274e64";
const INK = "#1d2326";
const LINE = "#c9d1d6";
const PIC = "#b8c9d3";

/** One block of the e-mail, 120 x H, in its colours. */
export function BlockThumb({ kind, layout, w = 120 }: { kind: BlockKind; layout?: "stacked" | "left" | "right"; w?: number }) {
  const h = kind === "article" ? articleH(layout) : HEIGHT[kind] ?? 40;
  const lines = (x: number, y: number, n: number, len = 70, gap = 6) =>
    Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * gap} width={i === n - 1 ? len * 0.6 : len} height={2.6} rx={1} fill={LINE} />);
  let body: React.ReactNode;
  switch (kind) {
    case "header":
      body = <><rect x={0} y={0} width={120} height={2.5} fill={RED} /><rect x={8} y={9} width={30} height={6} rx={1} fill={RED} /><rect x={82} y={11} width={30} height={2.6} rx={1} fill={LINE} /></>;
      break;
    case "hero":
      body = <><rect x={0} y={0} width={120} height={34} fill={PIC} /><rect x={8} y={40} width={14} height={2.5} fill={RED} /><rect x={8} y={46} width={80} height={5} rx={1} fill={INK} />{lines(8, 56, 2, 96)}<rect x={8} y={66} width={26} height={7} rx={1} fill={RED} /></>;
      break;
    case "article":
      body = layout === "left" || layout === "right"
        ? <><rect x={layout === "left" ? 8 : 80} y={6} width={32} height={30} fill={PIC} /><rect x={layout === "left" ? 46 : 8} y={8} width={52} height={4} rx={1} fill={INK} />{lines(layout === "left" ? 46 : 8, 17, 3, 64)}<rect x={layout === "left" ? 46 : 8} y={36} width={20} height={2.6} fill={RED} /></>
        : <><rect x={8} y={5} width={104} height={24} fill={PIC} /><rect x={8} y={34} width={60} height={4} rx={1} fill={INK} />{lines(8, 42, 2, 96)}<rect x={8} y={54} width={20} height={2.6} fill={RED} /></>;
      break;
    case "products":
      body = <>{[8, 45, 82].map((x) => <g key={x}><rect x={x} y={6} width={30} height={26} fill="#fff" stroke={LINE} /><rect x={x + 4} y={10} width={22} height={18} fill={PIC} /><rect x={x} y={36} width={24} height={3} rx={1} fill={INK} /><rect x={x} y={42} width={14} height={2.6} fill={RED} /></g>)}</>;
      break;
    case "banner":
      body = <rect x={0} y={4} width={120} height={30} fill={PIC} />;
      break;
    case "text":
      body = <>{lines(8, 8, 4, 104)}</>;
      break;
    case "facts":
      body = <><rect x={0} y={0} width={120} height={34} fill={PETROL} />{[10, 50, 90].map((x) => <g key={x}><rect x={x} y={9} width={22} height={6} rx={1} fill="#fff" /><rect x={x} y={19} width={20} height={2.4} rx={1} fill="#8fb0c1" /></g>)}</>;
      break;
    case "cta":
      body = <><rect x={0} y={0} width={120} height={34} fill="#f1f3f5" /><rect x={30} y={8} width={60} height={4} rx={1} fill={INK} /><rect x={44} y={18} width={32} height={8} rx={1} fill={RED} /></>;
      break;
    case "divider":
      body = <rect x={8} y={9} width={104} height={1.4} fill={LINE} />;
      break;
    case "footer":
      body = <><rect x={46} y={6} width={28} height={4} rx={1} fill={RED} />{lines(25, 15, 2, 70)}<rect x={40} y={29} width={40} height={2.4} rx={1} fill={LINE} /></>;
      break;
  }
  return (
    <Box component="svg" viewBox={`0 0 120 ${h}`} sx={{ width: w, height: (w / 120) * h, display: "block", bgcolor: "#fff" }} aria-hidden>
      {body}
    </Box>
  );
}

const HEIGHT: Partial<Record<BlockKind, number>> = { header: 24, hero: 80, article: 44, products: 48, banner: 38, text: 34, facts: 34, cta: 34, divider: 18, footer: 36 };
/** The article's height depends on its layout. */
const articleH = (layout?: string) => (layout === "left" || layout === "right" ? 44 : 60);

/** A whole layout, as a little e-mail. */
export function LayoutThumb({ blocks, w = 120 }: { blocks: Block[]; w?: number }) {
  return (
    <Box sx={{ width: w, bgcolor: "#fff", boxShadow: "0 1px 2px rgba(31,45,78,.12), 0 6px 18px rgba(31,45,78,.10)", overflow: "hidden" }}>
      {blocks.map((b) => <BlockThumb key={b.id} kind={b.kind} layout={b.kind === "article" ? b.layout : undefined} w={w} />)}
    </Box>
  );
}
