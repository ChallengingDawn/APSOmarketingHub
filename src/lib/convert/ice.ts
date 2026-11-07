// APSOconvert > THE IDEAS' RANKING (ICE): the AI scores each idea 1-5 for impact (how much add-to-carts should move),
// confidence (how strongly this page's numbers point to it) and effort (how much the version takes). One number ranks
// them: impact x confidence / effort. Pure - the pages import it without the server's database code.

export type Ice = { impact?: number | null; confidence?: number | null; effort?: number | null };

/** impact x confidence / effort (0.2-25), one decimal; null when the idea was not scored (an idea added by hand). */
export function iceScore(i: Ice): number | null {
  if (!i.impact || !i.confidence || !i.effort) return null;
  return Math.round(((i.impact * i.confidence) / i.effort) * 10) / 10;
}
