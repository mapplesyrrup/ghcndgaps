// Ordinary kriging, Amorim et al. (2012)'s "representativeness engine": the kriging
// variance at a point depends only on the geometry of known station locations and the
// variogram model — not on the observed data values — so it doubles as a pure network-
// coverage uncertainty surface. Low variance = well-represented by nearby stations; high
// variance = a gap in the network.

import { haversineKm, type LatLon } from "./geo";
import { luDecompose, luSolve, type LUDecomposition } from "./linalg";

export interface VariogramParams {
  rangeKm: number; // correlation length: beyond this, stations are treated as ~independent
  partialSill: number; // variance explained by spatial structure (normalized to 1 by default)
  nugget: number; // micro-scale / measurement noise, variance that's never "explained away"
}

export function covariance(h: number, v: VariogramParams): number {
  if (h <= 0) return v.partialSill + v.nugget;
  return v.partialSill * Math.exp(-h / v.rangeKm);
}

export interface KrigingSystem {
  lu: LUDecomposition;
  known: LatLon[];
}

// Builds and factorizes the (n+1)x(n+1) ordinary-kriging system (covariance matrix bordered
// by the unbiasedness constraint) once, so each candidate point only needs an O(n^2)
// forward/back-substitution instead of a fresh O(n^3) solve.
export function buildKrigingSystem(known: LatLon[], v: VariogramParams): KrigingSystem {
  const n = known.length;
  const size = n + 1;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = covariance(haversineKm(known[i], known[j]), v);
    }
    matrix[i][n] = 1;
    matrix[n][i] = 1;
  }
  matrix[n][n] = 0;

  return { lu: luDecompose(matrix), known };
}

export function krigingVariance(
  system: KrigingSystem,
  target: LatLon,
  v: VariogramParams,
): number {
  const n = system.known.length;
  if (n === 0) return v.partialSill + v.nugget; // no information anywhere: maximal uncertainty

  const b = new Array<number>(n + 1);
  for (let i = 0; i < n; i++) {
    b[i] = covariance(haversineKm(system.known[i], target), v);
  }
  b[n] = 1;

  const x = luSolve(system.lu, b);
  const lagrangeMultiplier = x[n];

  let variance = covariance(0, v);
  for (let i = 0; i < n; i++) variance -= x[i] * b[i];
  variance -= lagrangeMultiplier;

  return Math.max(0, variance);
}
