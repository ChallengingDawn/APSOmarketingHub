// CROP (canvas list 20).
//
// Every photograph in a layout is the wrong shape for the box it has to go
// in, and the subject is almost never in the middle. Without a crop the only
// moves available are "squash it" and "leave a gap", and people pick squash.
//
// The crop is stored as FRACTIONS of the source image, not pixels. The same
// design is opened against a 1200px web render and a 4000px original, and a
// crop in pixels would be a different picture in each. Konva wants pixels, so
// the conversion happens at the moment of drawing, where the real image is.
//
// The crop always keeps the photograph's own proportions: its aspect matches
// the box it is drawn into, so nothing is ever stretched. That is the whole
// difference between a crop and a resize.

export type Crop = { x: number; y: number; w: number; h: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Never outside the image, never zero-sized. */
export function clampCrop(c: Crop): Crop {
  const w = Math.min(1, Math.max(0.01, c.w));
  const h = Math.min(1, Math.max(0.01, c.h));
  return {
    w,
    h,
    // The offset has to leave room for the window itself.
    x: clamp01(Math.min(Math.max(0, c.x), 1 - w)),
    y: clamp01(Math.min(Math.max(0, c.y), 1 - h)),
  };
}

/**
 * The crop that FILLS the box without distorting the picture, centred.
 *
 * zoom 1 is as much of the photograph as the box's shape allows; zoom 2 is
 * half of that in each direction, which is what somebody means when they drag
 * a zoom slider on a photo.
 */
export function coverCrop(
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
  zoom = 1,
): Crop {
  const z = Math.max(1, zoom);
  if (!(natW > 0 && natH > 0 && boxW > 0 && boxH > 0)) return { x: 0, y: 0, w: 1, h: 1 };
  const boxAspect = boxW / boxH;
  const natAspect = natW / natH;
  // Whichever side has spare picture is the one that gets trimmed.
  const w = natAspect >= boxAspect ? boxAspect / natAspect : 1;
  const h = natAspect >= boxAspect ? 1 : natAspect / boxAspect;
  const cw = w / z;
  const ch = h / z;
  return clampCrop({ x: (1 - cw) / 2, y: (1 - ch) / 2, w: cw, h: ch });
}

/**
 * Move the picture inside its frame by a drag in canvas pixels.
 *
 * Dragging the photograph to the right shows more of its left side, so the
 * window moves the other way. Getting that backwards feels broken in a way
 * people cannot name but immediately stop using.
 */
export function panCrop(c: Crop, dxPx: number, dyPx: number, boxW: number, boxH: number): Crop {
  if (!(boxW > 0 && boxH > 0)) return clampCrop(c);
  return clampCrop({
    ...c,
    x: c.x - (dxPx / boxW) * c.w,
    y: c.y - (dyPx / boxH) * c.h,
  });
}

/** Change the zoom and keep looking at the same point of the picture. */
export function zoomCrop(
  c: Crop,
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
  zoom: number,
): Crop {
  const base = coverCrop(natW, natH, boxW, boxH, 1);
  const z = Math.max(1, zoom);
  const cw = base.w / z;
  const ch = base.h / z;
  // Keep the centre: zooming out from a corner should not walk the subject
  // off the edge of the frame.
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  return clampCrop({ x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch });
}

/** What the slider should read for a crop that already exists. */
export function zoomOf(
  c: Crop | undefined,
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
): number {
  if (!c) return 1;
  const base = coverCrop(natW, natH, boxW, boxH, 1);
  if (!(base.w > 0)) return 1;
  const z = base.w / c.w;
  return Math.max(1, Math.round(z * 100) / 100);
}

/** Source pixels, for the renderer. Rounded: a fractional pixel shimmers. */
export function cropToPixels(
  c: Crop | undefined,
  natW: number,
  natH: number,
): { x: number; y: number; width: number; height: number } | undefined {
  if (!c || !(natW > 0 && natH > 0)) return undefined;
  const k = clampCrop(c);
  return {
    x: Math.round(k.x * natW),
    y: Math.round(k.y * natH),
    width: Math.max(1, Math.round(k.w * natW)),
    height: Math.max(1, Math.round(k.h * natH)),
  };
}

/** A crop that is the whole picture is the absence of a crop. */
export function isWholeImage(c: Crop | undefined): boolean {
  if (!c) return true;
  return c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.999 && c.h >= 0.999;
}
