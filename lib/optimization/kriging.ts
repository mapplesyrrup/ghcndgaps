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

interface Solve {
  weights: number[];
  lagrangeMultiplier: number;
  targetCovariances: number[];
}

function solveForTarget(system: KrigingSystem, target: LatLon, v: VariogramParams): Solve {
  const n = system.known.length;
  const b = new Array<number>(n + 1);
  for (let i = 0; i < n; i++) {
    b[i] = covariance(haversineKm(system.known[i], target), v);
  }
  b[n] = 1;

  const x = luSolve(system.lu, b);
  return { weights: x.slice(0, n), lagrangeMultiplier: x[n], targetCovariances: b.slice(0, n) };
}

// True ordinary-kriging variance is provably bounded by C(0) (the "no information" case) —
// any excess is floating-point error from a near-singular solve (large, smooth-variogram
// systems stay somewhat ill-conditioned even after thinning nearby stations), not a real
// estimate, so clamp back into the valid range.
function varianceFromSolve(solve: Solve, v: VariogramParams): number {
  const maxVariance = covariance(0, v);
  let variance = maxVariance;
  for (let i = 0; i < solve.weights.length; i++) {
    variance -= solve.weights[i] * solve.targetCovariances[i];
  }
  variance -= solve.lagrangeMultiplier;
  return Math.max(0, Math.min(variance, maxVariance));
}

export function krigingVariance(
  system: KrigingSystem,
  target: LatLon,
  v: VariogramParams,
): number {
  const n = system.known.length;
  if (n === 0) return v.partialSill + v.nugget; // no information anywhere: maximal uncertainty

  return varianceFromSolve(solveForTarget(system, target, v), v);
}

export interface KrigingPrediction {
  estimate: number;
  variance: number;
}

// The other half of Amorim et al. (2012)'s kriging step: the same weights that produce the
// uncertainty surface also produce a best-linear-unbiased-estimate of the actual field value
// (a weighted average of nearby observations). `knownValues` must line up 1:1 with
// `system.known`.
export function krigingPredict(
  system: KrigingSystem,
  target: LatLon,
  knownValues: number[],
  v: VariogramParams,
): KrigingPrediction {
  const n = system.known.length;
  if (n === 0) return { estimate: NaN, variance: v.partialSill + v.nugget };

  const solve = solveForTarget(system, target, v);
  const variance = varianceFromSolve(solve, v);

  let estimate = 0;
  for (let i = 0; i < n; i++) estimate += solve.weights[i] * knownValues[i];

  // Kriging weights aren't constrained to [0, 1] individually (only to sum to 1), so a
  // still-imperfectly-conditioned solve can push the estimate slightly outside the observed
  // range. Nothing in this model (no elevation/covariate term) justifies extrapolating past
  // the data, so clamp to the convex hull of what was actually observed.
  const min = Math.min(...knownValues);
  const max = Math.max(...knownValues);
  estimate = Math.max(min, Math.min(estimate, max));

  return { estimate, variance };
}
