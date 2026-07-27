import { haversineKm, type LatLon } from "./geo";

export interface OperationalFilterOptions {
  maxDistanceToInfrastructureKm: number;
}

// Snyder (2018)'s pre-filter step: cut candidate sites on accessibility before scoring them,
// rather than optimizing over every grid cell. We don't have a real roads/population/cell-
// coverage layer wired up yet, so this uses proximity to *any* known GHCN station (not just
// the currently-active ones used for kriging) as a proxy — station placements historically
// cluster near reachable, inhabited locations. Swap the body for a real infrastructure
// dataset (OSM roads, population raster, carrier coverage maps) when one is available; the
// call site doesn't need to change.
export function passesOperationalFilter(
  candidate: LatLon,
  referenceStations: LatLon[],
  options: OperationalFilterOptions,
): boolean {
  if (referenceStations.length === 0) return true;

  for (const station of referenceStations) {
    if (haversineKm(candidate, station) <= options.maxDistanceToInfrastructureKm) {
      return true;
    }
  }
  return false;
}
