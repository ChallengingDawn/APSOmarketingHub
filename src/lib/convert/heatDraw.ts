// APSOconvert > the CLICK MAP drawn on the page, CLEAN (SARCLA 13.11.2026: "preview on click is not clean and clear" -
// every clicked element was tinted orange with an orange "N clicks" tag: the whole header bar, each product tile, tags
// over each other). Now only the elements that matter are drawn - the most clicked, with at least a share of the clicks -
// each with a thin outline, a light tint by its share and ONE small badge (the share; the count on hover), badges never
// over each other. Which elements, their share in words, and where each badge goes: pure, so it is tested. The frame
// (./preview.ts) runs HEAT_LAYOUT as it is written here.

/** What is drawn: the 12 most clicked elements with at least 1% of the page's clicks; in the page's header only the 5 most clicked. */
export const HEAT_DRAW = { top: 12, minShare: 0.01, headTop: 5 } as const;

/** An element's share of the page's clicks in words: "21%", "<1%" for a few, "" when nothing is counted. */
export function pctOf(n: number, total: number): string {
  if (!(total > 0) || !(n > 0)) return "";
  const p = (n / total) * 100;
  if (p < 1) return "<1%";
  return `${Math.min(100, Math.round(p))}%`;
}

/**
 * The elements drawn on the page (their selectors), the most clicked first: the top `HEAT_DRAW.top` that have at least
 * `HEAT_DRAW.minShare` of the clicks - and the one a person pointed at in the list, always.
 */
export function heatPick(list: { s: string; n: number }[], total: number, focus?: string | null): string[] {
  const sum = total > 0 ? total : list.reduce((t, i) => t + (i.n > 0 ? i.n : 0), 0);
  const out = [...list]
    .filter((i) => i.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, HEAT_DRAW.top)
    .filter((i) => sum > 0 && i.n / sum >= HEAT_DRAW.minShare)
    .map((i) => i.s);
  if (focus && !out.includes(focus) && list.some((i) => i.s === focus)) out.push(focus);
  return out;
}

/**
 * The legend's two parts: the drawn elements found on the page (the most clicked first), and the clicked elements the
 * page as drawn does not have, in one line - how many and their share of the clicks together.
 */
export function heatLegend(list: { s: string; n: number }[], total: number, missing: string[], drawn: string[]): {
  shown: { s: string; n: number; pct: string }[]; gone: { count: number; n: number; pct: string };
} {
  const miss = new Set(missing);
  const draw = new Set(drawn);
  const shown = list.filter((i) => draw.has(i.s) && !miss.has(i.s)).map((i) => ({ s: i.s, n: i.n, pct: pctOf(i.n, total) }));
  const goneList = list.filter((i) => miss.has(i.s));
  const n = goneList.reduce((t, i) => t + i.n, 0);
  return { shown, gone: { count: goneList.length, n, pct: pctOf(n, total) } };
}

/**
 * THE BADGES' PLACES, run in the preview's frame (ES5, no outside name). `items`, the most clicked first: each drawn
 * element's box on the page {x, y, w, h} and its badge's size {bw, bh}; `W` the page's width. Each badge goes to the first
 * free place of: above the box on the left, inside its top left corner, above on the right, inside top right, below on
 * the left - first a place that covers neither another badge nor another drawn element, else one that covers no badge.
 * No place free: no badge (the outline stays). `tint`: false for a box that holds another drawn box (the header bar
 * around the search field) - only its outline, so tints never pile up.
 */
export const HEAT_LAYOUT = `function heatLayout(items,W){
var g=2,placed=[],out=[];
function hits(a,b){return a.x<b.x+b.w+g&&a.x+a.w+g>b.x&&a.y<b.y+b.h+g&&a.y+a.h+g>b.y;}
function holds(a,b){return a!==b&&a.x<=b.x&&a.y<=b.y&&a.x+a.w>=b.x+b.w&&a.y+a.h>=b.y+b.h&&(a.w>b.w||a.h>b.h);}
for(var i=0;i<items.length;i++){var it=items[i],bw=it.bw,bh=it.bh,inner=it.w>=bw+2*g&&it.h>=bh+2*g;
var c=[[it.x,it.y-bh-g],inner?[it.x+g,it.y+g]:null,[it.x+it.w-bw,it.y-bh-g],inner?[it.x+it.w-bw-g,it.y+g]:null,[it.x,it.y+it.h+g]],got=null;
for(var pass=0;pass<2&&!got;pass++){for(var k=0;k<c.length&&!got;k++){if(!c[k])continue;
var b={x:Math.max(g,Math.min(W-bw-g,c[k][0])),y:Math.max(g,c[k][1]),w:bw,h:bh},bad=false;
for(var j=0;j<placed.length&&!bad;j++)if(hits(b,placed[j]))bad=true;
if(!bad&&pass===0)for(var m=0;m<items.length&&!bad;m++){if(m===i)continue;var o=items[m];if(holds(o,it)||holds(it,o))continue;if(hits(b,o))bad=true;}
if(!bad)got=b;}}
if(got)placed.push(got);
var tint=true;for(var q=0;q<items.length;q++)if(holds(it,items[q])){tint=false;break;}
out.push({b:got?{x:got.x,y:got.y}:null,tint:tint});}
return out;}`;
