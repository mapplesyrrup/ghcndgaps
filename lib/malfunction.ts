// Spatial-outlier malfunction detection, ported from the original offline analysis script.
// A station can keep reporting numbers while malfunctioning — a stuck sensor, a decimal/unit
// error, a miscalibrated gauge — which looks fine at a glance (a value exists) but disagrees
// badly with everything nearby was reporting that same day. For each station-day, this
// estimates what the station "should" have read from its neighbors (inverse-distance
// weighted, within SPATIAL_RADIUS_KM) and flags days where the actual reading is a robust
// statistical outlier (MAD-based z-score) against that estimate.
import { getReferenceData } from "./ghcnReference";
import { ensureDlyFilesCached, parseDly } from "./dly";
import { haversineKm } from "./optimization/geo";
import type {
  BoundingBox,
  MalfunctionDailySummary,
  MalfunctionResponse,
  MalfunctionStationResult,
  Variable,
} from "./types";

const SPATIAL_RADIUS_KM = 100; // neighbors must be within this distance to be used
const MIN_NEIGHBORS = 3; // need at least this many neighbors reporting that day
const MAD_Z_THRESHOLD = 3.5; // robust z-score beyond which a reading is "suspect"
const MALFUNCTION_SUSPECT_PCT = 20; // suspect% at/above this flags a station as likely malfunctioning

function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface DayEntry {
  id: string;
  lat: number;
  lon: number;
  value: number;
}

export async function runMalfunctionAnalysis(
  variable: Variable,
  startDate: Date,
  endDate: Date,
  bbox: BoundingBox,
): Promise<MalfunctionResponse> {
  const { stations, inventory } = await getReferenceData();

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const eligibleIds = new Set(
    inventory
      .filter(
        (row) =>
          row.element === variable && row.firstYear <= startYear && row.lastYear >= endYear,
      )
      .map((row) => row.id),
  );

  const candidates = stations.filter(
    (s) =>
      s.lat >= bbox.latMin &&
      s.lat <= bbox.latMax &&
      s.lon >= bbox.lonMin &&
      s.lon <= bbox.lonMax &&
      eligibleIds.has(s.id),
  );

  const stationIds = candidates.map((s) => s.id);
  await ensureDlyFilesCached(stationIds, endDate);

  const dates = dateRange(startDate, endDate);
  const dateKeys = dates.map((d) => d.toISOString().slice(0, 10));

  const valuesByStation = new Map<string, Map<string, number>>();
  for (const station of candidates) {
    valuesByStation.set(station.id, await parseDly(station.id, variable, startDate, endDate));
  }

  const daysChecked = new Map<string, number>();
  const suspectDays = new Map<string, number>();
  const daily: MalfunctionDailySummary[] = [];

  for (const key of dateKeys) {
    const dayEntries: DayEntry[] = [];
    for (const station of candidates) {
      const value = valuesByStation.get(station.id)?.get(key);
      if (value !== undefined) {
        dayEntries.push({ id: station.id, lat: station.lat, lon: station.lon, value });
      }
    }

    if (dayEntries.length < MIN_NEIGHBORS + 1) {
      daily.push({ date: key, stationsChecked: 0, suspectStations: 0, suspectPct: 0 });
      continue;
    }

    const residuals = new Map<string, number>();
    for (const entry of dayEntries) {
      const neighbors: { dist: number; value: number }[] = [];
      for (const other of dayEntries) {
        if (other.id === entry.id) continue;
        const dist = haversineKm(entry, other);
        if (dist <= SPATIAL_RADIUS_KM) neighbors.push({ dist, value: other.value });
      }
      if (neighbors.length < MIN_NEIGHBORS) continue;

      let weightSum = 0;
      let weightedValueSum = 0;
      for (const n of neighbors) {
        const w = 1 / Math.max(n.dist, 0.5);
        weightSum += w;
        weightedValueSum += w * n.value;
      }
      const estimate = weightedValueSum / weightSum;
      residuals.set(entry.id, entry.value - estimate);
    }

    if (residuals.size < 3) {
      daily.push({ date: key, stationsChecked: 0, suspectStations: 0, suspectPct: 0 });
      continue;
    }

    const residualValues = [...residuals.values()];
    const medianResidual = median(residualValues);
    let mad = median(residualValues.map((r) => Math.abs(r - medianResidual)));
    if (mad <= 1e-6) {
      const mean = residualValues.reduce((a, b) => a + b, 0) / residualValues.length;
      const variance =
        residualValues.reduce((a, b) => a + (b - mean) ** 2, 0) / residualValues.length;
      mad = Math.sqrt(variance) + 1e-6;
    }

    let daySuspectCount = 0;
    for (const [id, residual] of residuals) {
      const robustZ = (0.6745 * (residual - medianResidual)) / mad;
      const suspect = Math.abs(robustZ) > MAD_Z_THRESHOLD;
      daysChecked.set(id, (daysChecked.get(id) ?? 0) + 1);
      if (suspect) {
        suspectDays.set(id, (suspectDays.get(id) ?? 0) + 1);
        daySuspectCount++;
      }
    }

    daily.push({
      date: key,
      stationsChecked: residuals.size,
      suspectStations: daySuspectCount,
      suspectPct: Math.round((daySuspectCount / residuals.size) * 1000) / 10,
    });
  }

  const stationResults: MalfunctionStationResult[] = candidates.map((station) => {
    const checked = daysChecked.get(station.id) ?? 0;
    const suspect = suspectDays.get(station.id) ?? 0;
    const suspectPct = checked === 0 ? 0 : Math.round((suspect / checked) * 1000) / 10;
    return {
      id: station.id,
      lat: station.lat,
      lon: station.lon,
      name: station.name,
      daysChecked: checked,
      suspectDays: suspect,
      suspectPct,
      likelyMalfunctioning: suspectPct >= MALFUNCTION_SUSPECT_PCT,
    };
  });

  stationResults.sort((a, b) => b.suspectPct - a.suspectPct);

  return {
    variable,
    start: dateKeys[0] ?? "",
    end: dateKeys[dateKeys.length - 1] ?? "",
    bbox,
    stationCount: stationResults.length,
    stations: stationResults,
    daily,
  };
}
