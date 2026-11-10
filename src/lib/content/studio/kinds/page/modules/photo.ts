// PAGE - IS A PRODUCT PHOTO FIT FOR A MODULE? (Content v7, 10.11.2026). Pure: tests/studio-page-modules-clean.test.ts.
//
// The lead 10.11.2026: builder A's real runs filled a module with photos that carry a NEW! or LIQUIDATION sticker baked in.
// The home page kit checked every photo once and left out (tools/photo_audit.py, SARCLA 05.11: "some photos are really
// good, the others really bad"):
//   badge     a red sticker in a top corner (NEW!, LIQUIDATION ...)
//   colored   a coloured card behind the part (the shop's pink cart pictures) - black or white plates filling it are fine
//   drawing   not a photo: a black cross-section (flat dark fills) or a small part drawn with dimension lines, or a ...DR.jpg
// The same sums, on the pixels the server decodes (./source.ts photoOk reads the shop's 500 px picture with sharp).

export type PhotoFlaws = { badge: boolean; colored: boolean; drawing: boolean };

/** What is wrong with a photo, from its pixels (RGB or RGBA, row by row). `file` is its address (a ...DR.jpg is a drawing). */
export function photoFlaws(px: Uint8Array | Buffer, w: number, h: number, channels: number, file = ""): PhotoFlaws {
  const n = w * h;
  const gray = new Float32Array(n);
  const fg = new Uint8Array(n);
  let fgN = 0;
  for (let i = 0; i < n; i++) {
    const r = px[i * channels], g = px[i * channels + 1], b = px[i * channels + 2];
    const gr = (r + g + b) / 3;
    gray[i] = gr;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // darker than the backdrop, or clearly coloured
    if (gr < 232 || mx - mn > 30) { fg[i] = 1; fgN++; }
  }
  const frac = fgN / Math.max(1, n);
  // grey-level entropy of the part, its dark share, its sharp edges
  const hist = new Float64Array(64);
  let dark = 0, edges = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!fg[i]) continue;
      hist[Math.min(63, Math.floor(gray[i] / 4))]++;
      if (gray[i] < 60) dark++;
      const gx = x === 0 ? gray[i + 1] - gray[i] : x === w - 1 ? gray[i] - gray[i - 1] : (gray[i + 1] - gray[i - 1]) / 2;
      const gy = y === 0 ? gray[i + w] - gray[i] : y === h - 1 ? gray[i] - gray[i - w] : (gray[i + w] - gray[i - w]) / 2;
      if (Math.hypot(gx, gy) > 40) edges++;
    }
  }
  let ent = 0;
  for (const c of hist) { if (c) { const p = c / Math.max(1, fgN); ent -= p * Math.log2(p); } }
  const darkShare = fgN ? dark / fgN : 0;
  const edgeShare = fgN ? edges / fgN : 0;
  const drawing = /DR\.(jpe?g|png)$|\/dr\//i.test(file) || (ent < 2 && darkShare > 0.5 && frac < 0.7) || (edgeShare > 0.12 && frac < 0.25);
  // a red sticker in a top corner
  const cw = Math.floor(w * 0.28), chh = Math.floor(h * 0.28);
  const redShare = (x0: number) => {
    let red = 0;
    for (let y = 0; y < chh; y++) for (let x = x0; x < x0 + cw; x++) {
      const i = (y * w + x) * channels;
      if (px[i] > 170 && px[i + 1] < 90 && px[i + 2] < 90) red++;
    }
    return red / Math.max(1, cw * chh);
  };
  const badge = Math.max(redShare(0), redShare(w - cw)) > 0.03;
  // the corners: a coloured card behind the part
  const k = Math.max(4, Math.floor(Math.min(w, h) * 0.1));
  let sat = 0, gsum = 0, cn = 0;
  for (const [x0, y0] of [[0, 0], [w - k, 0], [0, h - k], [w - k, h - k]]) {
    for (let y = y0; y < y0 + k; y++) for (let x = x0; x < x0 + k; x++) {
      const i = (y * w + x) * channels;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      sat += Math.max(r, g, b) - Math.min(r, g, b);
      gsum += (r + g + b) / 3;
      cn++;
    }
  }
  const colored = sat / cn > 40 && gsum / cn > 70 && gsum / cn < 235;
  return { badge, colored, drawing };
}

export const photoBad = (f: PhotoFlaws) => f.badge || f.colored || f.drawing;
