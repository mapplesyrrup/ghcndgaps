import type { Variable } from "./types";

export interface OptimizeFormState {
  variable: Variable;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  gridSize: number;
  numNewStations: number;
  rangeKm: number;
  minDistanceKm: number;
}

export function defaultOptimizeFormState(): OptimizeFormState {
  return {
    variable: "TMAX",
    // Same Florida / Gulf Coast box as the gaps tab's default.
    latMin: 26,
    latMax: 31,
    lonMin: -84,
    lonMax: -79.5,
    gridSize: 16,
    numNewStations: 5,
    rangeKm: 150,
    minDistanceKm: 75,
  };
}
