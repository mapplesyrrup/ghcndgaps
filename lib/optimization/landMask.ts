import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { MultiPolygon, Polygon, Position } from "geojson";
import type { LatLon } from "./geo";

// Natural Earth's 1:50m land layer (public domain, via the `world-atlas` package) — coarse
// enough to bundle (~550KB) but detailed enough to keep candidate sites off the open ocean at
// the grid resolutions this tool uses. It won't catch every small inlet or narrow spit, so
// treat it as "clearly not water" rather than survey-grade.
const DATA_PATH = path.join(process.cwd(), "lib/optimization/data/land-50m.json");

interface Ring {
  points: Position[];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface PolygonBounds {
  rings: Ring[]; // rings[0] is the exterior, the rest are holes
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

let cachedPolygons: PolygonBounds[] | null = null;

function buildRing(points: Position[]): Ring {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { points, minLon, maxLon, minLat, maxLat };
}

function buildPolygon(rawRings: Position[][]): PolygonBounds {
  const rings = rawRings.map(buildRing);
  const exterior = rings[0];
  return {
    rings,
    minLon: exterior.minLon,
    maxLon: exterior.maxLon,
    minLat: exterior.minLat,
    maxLat: exterior.maxLat,
  };
}

function loadLandPolygons(): PolygonBounds[] {
  if (cachedPolygons) return cachedPolygons;

  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const topology = JSON.parse(raw) as Topology;
  const collection = topojson.feature(topology, topology.objects.land);

  const polygons: PolygonBounds[] = [];
  const geometries =
    collection.type === "FeatureCollection"
      ? collection.features.map((f) => f.geometry)
      : [collection.geometry];

  for (const geometry of geometries) {
    if (geometry.type === "Polygon") {
      polygons.push(buildPolygon((geometry as Polygon).coordinates));
    } else if (geometry.type === "MultiPolygon") {
      for (const rawRings of (geometry as MultiPolygon).coordinates) {
        polygons.push(buildPolygon(rawRings));
      }
    }
  }

  cachedPolygons = polygons;
  return polygons;
}

// Standard even-odd ray-casting test, with a bounding-box short-circuit since most of the
// world's ~1400 land polygons are nowhere near any given point.
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  if (lon < ring.minLon || lon > ring.maxLon || lat < ring.minLat || lat > ring.maxLat) {
    return false;
  }

  let inside = false;
  const pts = ring.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Land polygons whose bounding box could plausibly overlap the given bbox, in
// [[ring, ...], ...] form (one entry per polygon, each ring an array of [lon, lat] points) —
// a cheap pre-filter so callers doing real polygon clipping (see lib/optimization/landClip.ts)
// only pay for the handful of landmasses actually near the query instead of all ~1400 in the
// world dataset.
export function getLandPolygonsNear(bbox: {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}): Position[][][] {
  const polygons = loadLandPolygons();
  const result: Position[][][] = [];
  for (const polygon of polygons) {
    if (
      polygon.maxLon < bbox.lonMin ||
      polygon.minLon > bbox.lonMax ||
      polygon.maxLat < bbox.latMin ||
      polygon.minLat > bbox.latMax
    ) {
      continue;
    }
    result.push(polygon.rings.map((r) => r.points));
  }
  return result;
}

export function isOnLand(point: LatLon): boolean {
  const polygons = loadLandPolygons();

  for (const polygon of polygons) {
    if (
      point.lon < polygon.minLon ||
      point.lon > polygon.maxLon ||
      point.lat < polygon.minLat ||
      point.lat > polygon.maxLat
    ) {
      continue;
    }

    if (!pointInRing(point.lon, point.lat, polygon.rings[0])) continue;

    let inHole = false;
    for (let i = 1; i < polygon.rings.length; i++) {
      if (pointInRing(point.lon, point.lat, polygon.rings[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }

  return false;
}
