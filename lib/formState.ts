import type { Variable } from "./types";

export interface FormState {
  variable: Variable;
  start: string;
  end: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultFormState(): FormState {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 14);
  return {
    variable: "TMAX",
    start: isoDate(start),
    end: isoDate(end),
    // Florida / Gulf Coast box (same region as the Hurricane Ian case study) —
    // small enough to comfortably stay under the station cap by default.
    latMin: 26,
    latMax: 31,
    lonMin: -84,
    lonMax: -79.5,
  };
}
