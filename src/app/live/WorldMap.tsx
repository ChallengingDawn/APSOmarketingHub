"use client";

// A world map with one dot per country, sized by active users. Land is drawn
// from the bundled Natural Earth 110m atlas — no tiles, no network — and
// projected with Natural Earth 1. Countries GA4 names differently from the
// atlas are bridged by ALIASES; anything still unmatched is listed under the
// map rather than dropped.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { geoCentroid, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import { ACCENT, CHROME } from "@/app/charts/palette";

type CountryProps = { name: string };
type Atlas = Topology<{ countries: GeometryCollection<CountryProps> }>;

/** GA4 country name → Natural Earth 110m name, where they differ. */
const ALIASES: Record<string, string> = {
  "United States": "United States of America",
  "Bosnia & Herzegovina": "Bosnia and Herz.",
  Türkiye: "Turkey",
  "Dominican Republic": "Dominican Rep.",
  "Central African Republic": "Central African Rep.",
  "Congo - Kinshasa": "Dem. Rep. Congo",
  "Congo - Brazzaville": "Congo",
  "Côte d’Ivoire": "Côte d'Ivoire",
  "Myanmar (Burma)": "Myanmar",
  Eswatini: "eSwatini",
  "South Sudan": "S. Sudan",
  "Equatorial Guinea": "Eq. Guinea",
  "Solomon Islands": "Solomon Is.",
  "Western Sahara": "W. Sahara",
  "Falkland Islands (Islas Malvinas)": "Falkland Is.",
  "Timor-Leste": "Timor-Leste",
  "North Macedonia": "North Macedonia",
};

const W = 960;
const H = 470;

export type MapPoint = { country: string; value: number };

export function WorldMap({ points, unit = "active users" }: { points: MapPoint[]; unit?: string }) {
  const { land, path, locate } = useMemo(() => {
    const topo = world as unknown as Atlas;
    const countries = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, CountryProps>;
    const projection = geoNaturalEarth1().fitExtent(
      [
        [8, 8],
        [W - 8, H - 8],
      ],
      countries,
    );
    const p = geoPath(projection);
    const byName = new Map<string, Feature<Geometry, CountryProps>>();
    for (const f of countries.features) byName.set(f.properties.name, f);
    const locate = (name: string): [number, number] | null => {
      const f = byName.get(ALIASES[name] ?? name);
      if (!f) return null;
      const c = projection(geoCentroid(f));
      return c ? [c[0], c[1]] : null;
    };
    return { land: p(countries) ?? "", path: p, locate };
  }, []);

  const max = Math.max(1, ...points.map((pt) => pt.value));
  const placed: { country: string; value: number; x: number; y: number; r: number }[] = [];
  const unmatched: MapPoint[] = [];
  for (const pt of points) {
    if (pt.value <= 0) continue;
    const xy = locate(pt.country);
    if (!xy) {
      unmatched.push(pt);
      continue;
    }
    placed.push({ ...pt, x: xy[0], y: xy[1], r: 4 + Math.sqrt(pt.value / max) * 16 });
  }
  placed.sort((a, b) => b.r - a.r);
  void path;

  return (
    <Box>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`World map with ${placed.length} countries showing ${unit}`}
        sx={{ width: "100%", height: "auto", display: "block" }}
      >
        <path d={land} fill="#eceff3" stroke="#ffffff" strokeWidth={0.6} />
        {placed.map((pt) => (
          <g key={pt.country}>
            <circle cx={pt.x} cy={pt.y} r={pt.r + 2} fill="#ffffff" opacity={0.9} />
            <circle cx={pt.x} cy={pt.y} r={pt.r} fill={ACCENT} opacity={0.85}>
              <title>{`${pt.country} · ${pt.value} ${unit}`}</title>
            </circle>
          </g>
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mt: 1 }}>
        <Typography sx={{ fontSize: "0.74rem", color: CHROME.muted }}>
          Dot size follows {unit}; hover a dot for the country.
        </Typography>
        {unmatched.length > 0 && (
          <Typography sx={{ fontSize: "0.74rem", color: CHROME.muted }}>
            Not on the map (no outline at this scale): {unmatched.map((u) => `${u.country} ${u.value}`).join(", ")}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
