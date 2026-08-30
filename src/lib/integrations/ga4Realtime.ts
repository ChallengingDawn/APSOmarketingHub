// GA4 Realtime — who is on apsoparts.com right now. The realtime endpoint
// covers the last 30 minutes and takes its own, smaller set of dimensions.
// Every figure is a value the API returned; nothing is smoothed or estimated.

import { googleFetchJson } from "./google";
import { ga4PropertyId } from "./status";
import { GA4_SCOPE } from "./ga4";

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

export type RealtimeRow = { key: string; activeUsers: number | null };
export type RealtimeCity = { city: string; country: string; activeUsers: number | null };
export type RealtimeMinute = { minutesAgo: number; activeUsers: number | null };

export type Ga4Realtime = {
  propertyId: string;
  fetchedAt: string;
  /** Active users in the last 30 minutes, as GA4 reports the total. */
  activeUsers: number | null;
  byCountry: RealtimeRow[];
  byCity: RealtimeCity[];
  byMinute: RealtimeMinute[];
  byPage: RealtimeRow[];
  byDevice: RealtimeRow[];
};

type Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type RealtimeResponse = { rows?: Row[]; totals?: Row[] };

function num(raw: string | undefined): number | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function realtime(
  propertyId: string,
  body: { dimensions?: { name: string }[]; limit?: string; minuteRanges?: unknown[] },
  signal?: AbortSignal,
): Promise<RealtimeResponse> {
  return googleFetchJson<RealtimeResponse>({
    url: `${DATA_API}/properties/${encodeURIComponent(propertyId)}:runRealtimeReport`,
    scope: GA4_SCOPE,
    label: "GA4 realtime",
    method: "POST",
    body: { metrics: [{ name: "activeUsers" }], ...body },
    signal,
  });
}

function single(res: RealtimeResponse): RealtimeRow[] {
  return (res.rows ?? []).flatMap((row) => {
    const key = row.dimensionValues?.[0]?.value;
    if (typeof key !== "string" || key.length === 0) return [];
    return [{ key, activeUsers: num(row.metricValues?.[0]?.value) }];
  });
}

export async function fetchGa4Realtime(signal?: AbortSignal): Promise<Ga4Realtime> {
  const propertyId = ga4PropertyId();
  const last30 = [{ name: "last30", startMinutesAgo: 29, endMinutesAgo: 0 }];

  const [totalRes, countryRes, cityRes, minuteRes, pageRes, deviceRes] = await Promise.all([
    realtime(propertyId, { minuteRanges: last30 }, signal),
    realtime(propertyId, { dimensions: [{ name: "country" }], limit: "60", minuteRanges: last30 }, signal),
    realtime(propertyId, { dimensions: [{ name: "city" }, { name: "country" }], limit: "25", minuteRanges: last30 }, signal),
    realtime(propertyId, { dimensions: [{ name: "minutesAgo" }], limit: "30", minuteRanges: last30 }, signal),
    realtime(propertyId, { dimensions: [{ name: "unifiedScreenName" }], limit: "10", minuteRanges: last30 }, signal),
    realtime(propertyId, { dimensions: [{ name: "deviceCategory" }], limit: "5", minuteRanges: last30 }, signal),
  ]);

  const totalRow = totalRes.rows?.[0] ?? totalRes.totals?.[0] ?? null;

  const byMinute: RealtimeMinute[] = (minuteRes.rows ?? [])
    .flatMap((row) => {
      const m = Number(row.dimensionValues?.[0]?.value);
      if (!Number.isFinite(m)) return [];
      return [{ minutesAgo: m, activeUsers: num(row.metricValues?.[0]?.value) }];
    })
    .sort((a, b) => b.minutesAgo - a.minutesAgo);

  const byCity: RealtimeCity[] = (cityRes.rows ?? []).flatMap((row) => {
    const city = row.dimensionValues?.[0]?.value;
    const country = row.dimensionValues?.[1]?.value;
    if (typeof city !== "string" || !city) return [];
    return [{ city, country: typeof country === "string" ? country : "", activeUsers: num(row.metricValues?.[0]?.value) }];
  });

  return {
    propertyId,
    fetchedAt: new Date().toISOString(),
    activeUsers: totalRow ? num(totalRow.metricValues?.[0]?.value) : null,
    byCountry: single(countryRes).sort((a, b) => (b.activeUsers ?? 0) - (a.activeUsers ?? 0)),
    byCity: byCity.sort((a, b) => (b.activeUsers ?? 0) - (a.activeUsers ?? 0)),
    byMinute,
    byPage: single(pageRes),
    byDevice: single(deviceRes),
  };
}
