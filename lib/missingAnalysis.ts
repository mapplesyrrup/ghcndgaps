import { getReferenceData } from "./ghcnReference";
import { ensureDlyFilesCached, parseDly } from "./dly";
import {
  type BoundingBox,
  type DailySummary,
  type StationResult,
  type StationsResponse,
  type Variable,
} from "./types";

function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function runMissingAnalysis(
  variable: Variable,
  startDate: Date,
  endDate: Date,
  bbox: BoundingBox,
): Promise<StationsResponse> {
  const { stations, inventory } = await getReferenceData();

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();

  const eligibleIds = new Set(
    inventory
      .filter(
        (row) =>
          row.element === variable &&
          row.firstYear <= startYear &&
          row.lastYear >= endYear,
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

  const reportingByDate = new Map<string, number>(dateKeys.map((k) => [k, 0]));
  const stationResults: StationResult[] = [];

  for (const station of candidates) {
    const values = await parseDly(station.id, variable, startDate, endDate);
    const missingDays = dateKeys.filter((k) => !values.has(k)).length;
    for (const k of values.keys()) {
      reportingByDate.set(k, (reportingByDate.get(k) ?? 0) + 1);
    }
    stationResults.push({
      id: station.id,
      lat: station.lat,
      lon: station.lon,
      name: station.name,
      totalDays: dateKeys.length,
      missingDays,
      missingPct:
        dateKeys.length === 0
          ? 0
          : Math.round((missingDays / dateKeys.length) * 1000) / 10,
    });
  }

  const total = candidates.length;
  const daily: DailySummary[] = dateKeys.map((date) => {
    const reporting = reportingByDate.get(date) ?? 0;
    const missing = total - reporting;
    return {
      date,
      reporting,
      missing,
      total,
      missingPct: total === 0 ? 0 : Math.round((missing / total) * 1000) / 10,
    };
  });

  stationResults.sort((a, b) => b.missingPct - a.missingPct);

  return {
    variable,
    start: dateKeys[0] ?? "",
    end: dateKeys[dateKeys.length - 1] ?? "",
    bbox,
    stationCount: total,
    stations: stationResults,
    daily,
  };
}
