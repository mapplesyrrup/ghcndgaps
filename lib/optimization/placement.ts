import type { LatLon } from "./geo";
import { haversineKm, thinByMinSpacing } from "./geo";
import { buildKrigingSystem, krigingVariance, type VariogramParams } from "./kriging";
import { sitingQualityMultiplier } from "./sitingQuality";

// Ordinary kriging is O(n^3) to factorize; capping the active-station count keeps a single
// request fast even over a dense, continent-scale bbox. Stations beyond the cap are dropped
// by distance from the region's center, which is a reasonable approximation for MVP but is
// a global cap rather than true moving-window/local kriging — revisit if placements near the
// edge of a large, dense bbox look under-informed.
const MAX_KRIGING_STATIONS = 150;

// Below this spacing, nearby GHCN stations make the covariance matrix ill-conditioned (see
// thinByMinSpacing) — thin before capping so the cap keeps genuinely spread-out stations
// instead of a cluster of near-duplicates close to the bbox center.
const MIN_STATION_SPACING_KM = 3;

export function capActiveStations<T extends LatLon>(stations: T[], center: LatLon): T[] {
  const thinned = thinByMinSpacing(stations, MIN_STATION_SPACING_KM);
  if (thinned.length <= MAX_KRIGING_STATIONS) return thinned;
  return [...thinned]
    .sort((a, b) => haversineKm(center, a) - haversineKm(center, b))
    .slice(0, MAX_KRIGING_STATIONS);
}

export interface ScoredCell extends LatLon {
  variance: number;
  operational: boolean;
  score: number;
}

// The uncertainty surface for the whole candidate grid, given the current network. This is
// what renders as the heatmap — independent of how many new stations we go on to place.
export function scoreGrid(
  activeStations: LatLon[],
  candidates: LatLon[],
  variogram: VariogramParams,
  operationalMask: boolean[],
): ScoredCell[] {
  const system = buildKrigingSystem(activeStations, variogram);
  return candidates.map((cell, i) => {
    const variance = krigingVariance(system, cell, variogram);
    const operational = operationalMask[i];
    const score = operational ? variance * sitingQualityMultiplier(cell) : 0;
    return { ...cell, variance, operational, score };
  });
}

export interface SelectedSite extends LatLon {
  rank: number;
  score: number;
}

// Amorim et al. (2012)'s greedy expansion loop: repeatedly place a station at the point of
// highest remaining uncertainty, then recompute the surface with it added, so later picks
// account for the coverage the earlier picks already bought.
export function greedyPlacement(
  activeStations: LatLon[],
  candidates: LatLon[],
  variogram: VariogramParams,
  operationalMask: boolean[],
  count: number,
): SelectedSite[] {
  const active = [...activeStations];
  let remaining = candidates.filter((_, i) => operationalMask[i]);
  const selected: SelectedSite[] = [];

  for (let rank = 1; rank <= count && remaining.length > 0; rank++) {
    const system = buildKrigingSystem(active, variogram);

    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const variance = krigingVariance(system, remaining[i], variogram);
      const score = variance * sitingQualityMultiplier(remaining[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) break;

    const chosen = remaining[bestIndex];
    selected.push({ lat: chosen.lat, lon: chosen.lon, rank, score: bestScore });
    active.push(chosen);
    remaining = remaining.filter((_, i) => i !== bestIndex);
  }

  return selected;
}
