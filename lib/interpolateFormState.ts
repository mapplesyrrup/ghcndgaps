import type { Variable } from "./types";

export interface InterpolateFormState {
  variable: Variable;
  start: string;
  end: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  gridSize: number;
  rangeKm: number;
  contourLevels: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultInterpolateFormState(): InterpolateFormState {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 14);
  return {
    variable: "TMAX",
    start: isoDate(start),
    end: isoDate(end),
    // Same Florida / Gulf Coast box as the other tabs' defaults.
    latMin: 26,
    latMax: 31,
    lonMin: -84,
    lonMax: -79.5,
    gridSize: 30,
    rangeKm: 150,
    contourLevels: 8,
  };
}
