// polygon-clipping's ESM build only has a default export (an object with these four methods) —
// its .d.ts declares them as named exports instead, which doesn't match at runtime under
// Turbopack, so import the value as default and the types separately (type-only imports are
// erased before that mismatch would matter).
import polygonClipping from "polygon-clipping";
import type { MultiPolygon, Polygon } from "polygon-clipping";
import type { BoundingBox } from "../types";
import { getLandPolygonsNear } from "./landMask";

type Ring = [number, number][];

function bboxRing(bbox: BoundingBox): Ring {
  return [
    [bbox.lonMin, bbox.latMin],
    [bbox.lonMax, bbox.latMin],
    [bbox.lonMax, bbox.latMax],
    [bbox.lonMin, bbox.latMax],
    [bbox.lonMin, bbox.latMin],
  ];
}

// Land geometry clipped down to just the query bbox, computed once per request and reused
// for every Voronoi cell / contour path clip below — much cheaper than intersecting each of
// those against the full world land dataset.
export function landWithinBbox(bbox: BoundingBox): MultiPolygon {
  const nearby = getLandPolygonsNear(bbox) as unknown as MultiPolygon;
  if (nearby.length === 0) return [];
  return polygonClipping.intersection(nearby, [bboxRing(bbox)]);
}

// Clips a filled ring (e.g. a Voronoi cell) to land. A cell straddling water (a barrier
// island, a peninsula) can split into more than one piece, so this returns 0+ rings.
export function clipRingToLand(ring: Ring, land: MultiPolygon): Ring[] {
  if (land.length === 0) return [];
  const clipped = polygonClipping.intersection([ring] as Polygon, land);
  return clipped.map((polygon) => polygon[0]).filter((r) => r.length >= 4);
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointOnLand(x: number, y: number, land: MultiPolygon): boolean {
  for (const polygon of land) {
    if (!pointInRing(x, y, polygon[0])) continue;
    let inHole = false;
    for (let i = 1; i < polygon.length; i++) {
      if (pointInRing(x, y, polygon[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

// Splits a contour path into the sub-runs that stay on land, dropping the stretches that
// cross open water. Cheap point-in-polygon per vertex rather than true line/polygon
// clipping — fine at the vertex density these contours are sampled at.
export function splitPathToLand(path: Ring, land: MultiPolygon): Ring[] {
  if (land.length === 0) return [];
  const segments: Ring[] = [];
  let current: Ring = [];
  for (const point of path) {
    if (isPointOnLand(point[0], point[1], land)) {
      current.push(point);
    } else if (current.length >= 2) {
      segments.push(current);
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}
