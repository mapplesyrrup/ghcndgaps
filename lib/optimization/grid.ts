import type { BoundingBox } from "../types";
import type { LatLon } from "./geo";

export interface CandidateGrid {
  cells: LatLon[];
  latStep: number;
  lonStep: number;
}

// Cell-center grid over the bbox. This *is* the candidate pool Snyder (2018) pre-filters
// before scoring — real accessibility/expert-site inputs can be merged into `cells` later
// without changing anything downstream.
export function buildCandidateGrid(bbox: BoundingBox, gridSize: number): CandidateGrid {
  const latStep = (bbox.latMax - bbox.latMin) / gridSize;
  const lonStep = (bbox.lonMax - bbox.lonMin) / gridSize;
  const cells: LatLon[] = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      cells.push({
        lat: bbox.latMin + latStep * (i + 0.5),
        lon: bbox.lonMin + lonStep * (j + 0.5),
      });
    }
  }

  return { cells, latStep, lonStep };
}
