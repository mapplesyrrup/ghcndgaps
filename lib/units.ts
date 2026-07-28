import type { Variable } from "./types";

// GHCN-D stores TMAX/TMIN/TAVG in tenths of °C, PRCP in tenths of mm, and SNOW in mm.
const UNITS: Record<Variable, { label: string; toDisplay: (raw: number) => number }> = {
  TMAX: { label: "°C", toDisplay: (v) => v / 10 },
  TMIN: { label: "°C", toDisplay: (v) => v / 10 },
  TAVG: { label: "°C", toDisplay: (v) => v / 10 },
  PRCP: { label: "mm", toDisplay: (v) => v / 10 },
  SNOW: { label: "mm", toDisplay: (v) => v },
};

export function toDisplayUnit(variable: Variable, raw: number): number {
  return UNITS[variable].toDisplay(raw);
}

export function unitLabel(variable: Variable): string {
  return UNITS[variable].label;
}
