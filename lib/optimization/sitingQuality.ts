import type { LatLon } from "./geo";

// Physical siting quality (obstructions, heat sources, land cover, slope) per WMO /
// Brown-Russell rules. Neither Snyder (2018) nor Amorim et al. (2012) model this — it needs
// a GIS layer (building footprints, land cover, DEM) we don't have wired up yet. This stub
// returns a neutral multiplier so the scoring pipeline
// (kriging uncertainty * operational filter * siting quality) already has the multiplication
// slot; a real penalty function can drop in here without touching callers.
export function sitingQualityMultiplier(_candidate: LatLon): number {
  return 1;
}
