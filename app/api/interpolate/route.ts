import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Delaunay } from "d3-delaunay";
import { contours as contourGenerator } from "d3-contour";
import { getReferenceData } from "@/lib/ghcnReference";
import { ensureDlyFilesCached, parseDly } from "@/lib/dly";
import { VARIABLES, type ContourLine, type InterpolateResponse } from "@/lib/types";
import { toDisplayUnit, unitLabel } from "@/lib/units";
import { buildCandidateGrid } from "@/lib/optimization/grid";
import { buildKrigingSystem, krigingPredict, type VariogramParams } from "@/lib/optimization/kriging";
import { capActiveStations } from "@/lib/optimization/placement";

const querySchema = z
  .object({
    variable: z.enum(VARIABLES),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    latMin: z.coerce.number().min(-90).max(90),
    latMax: z.coerce.number().min(-90).max(90),
    lonMin: z.coerce.number().min(-180).max(180),
    lonMax: z.coerce.number().min(-180).max(180),
    gridSize: z.coerce.number().int().min(8).max(60).default(30),
    rangeKm: z.coerce.number().min(5).max(2000).default(150),
    contourLevels: z.coerce.number().int().min(3).max(15).default(8),
  })
  .refine((v) => v.latMin <= v.latMax, {
    message: "latMin must be <= latMax",
    path: ["latMin"],
  })
  .refine((v) => v.lonMin <= v.lonMax, {
    message: "lonMin must be <= lonMax",
    path: ["lonMin"],
  })
  .refine((v) => new Date(`${v.start}T00:00:00Z`) <= new Date(`${v.end}T00:00:00Z`), {
    message: "start must be on or before end",
    path: ["start"],
  });

const REQUEST_TIMEOUT_MS = 45_000;

class RequestTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new RequestTimeoutError(`Timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Converts a d3-contour ring — coordinates in grid-index space, where [0, gridSize] on each
// axis spans the bbox — back into [lon, lat] pairs.
function ringToLonLat(
  ring: [number, number][],
  bbox: { latMin: number; lonMin: number },
  lonStep: number,
  latStep: number,
): [number, number][] {
  return ring.map(([x, y]) => [bbox.lonMin + x * lonStep, bbox.latMin + y * latStep]);
}

async function computeInterpolation(
  params: z.infer<typeof querySchema>,
): Promise<InterpolateResponse> {
  const {
    variable,
    start,
    end,
    latMin,
    latMax,
    lonMin,
    lonMax,
    gridSize,
    rangeKm,
    contourLevels,
  } = params;
  const bbox = { latMin, latMax, lonMin, lonMax };
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  const { stations, inventory } = await getReferenceData();

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const eligibleIds = new Set(
    inventory
      .filter(
        (row) =>
          row.element === variable && row.firstYear <= startYear && row.lastYear >= endYear,
      )
      .map((row) => row.id),
  );

  const inBbox = stations.filter(
    (s) =>
      s.lat >= latMin && s.lat <= latMax && s.lon >= lonMin && s.lon <= lonMax &&
      eligibleIds.has(s.id),
  );

  const center = { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 };
  // Same station cap/thinning as the optimization tab: bounds both the .dly download cost
  // and the kriging solve, and keeps the covariance matrix well-conditioned. It also keeps
  // the Voronoi diagram below from producing degenerate slivers between near-duplicate sites.
  const candidates = capActiveStations(inBbox, center);

  await ensureDlyFilesCached(candidates.map((s) => s.id), endDate);

  const known: { lat: number; lon: number }[] = [];
  const knownValuesRaw: number[] = [];
  const existingStations: InterpolateResponse["existingStations"] = [];

  for (const station of candidates) {
    const values = await parseDly(station.id, variable, startDate, endDate);
    if (values.size === 0) continue;

    let sum = 0;
    for (const v of values.values()) sum += v;
    const meanRaw = sum / values.size;

    known.push({ lat: station.lat, lon: station.lon });
    knownValuesRaw.push(meanRaw);
    existingStations.push({
      id: station.id,
      lat: station.lat,
      lon: station.lon,
      name: station.name,
      value: toDisplayUnit(variable, meanRaw),
    });
  }

  const variogram: VariogramParams = { rangeKm, partialSill: 1, nugget: 0.05 };
  const system = buildKrigingSystem(known, variogram);

  // Dense sampling grid (unlike the optimize tab, not land-masked — isoline/Thiessen maps
  // conventionally cover the whole study area, water included) purely to feed the marching
  // squares contour generator; it isn't returned to the client itself.
  const { cells, latStep, lonStep } = buildCandidateGrid(bbox, gridSize);
  const values = cells.map(
    (cell) => toDisplayUnit(variable, krigingPredict(system, cell, knownValuesRaw, variogram).estimate),
  );

  const combined = [...values, ...existingStations.map((s) => s.value)].filter(Number.isFinite);
  const minValue = combined.length ? Math.min(...combined) : 0;
  const maxValue = combined.length ? Math.max(...combined) : 1;

  const contours: ContourLine[] = [];
  if (known.length > 0 && maxValue > minValue) {
    const generator = contourGenerator().size([gridSize, gridSize]);
    const levels = Array.from(
      { length: contourLevels },
      (_, i) => minValue + ((i + 1) * (maxValue - minValue)) / (contourLevels + 1),
    );

    for (const level of levels) {
      const multiPolygon = generator.contour(values, level);
      const paths: [number, number][][] = [];
      for (const polygon of multiPolygon.coordinates) {
        for (const ring of polygon) {
          if (ring.length >= 3) {
            paths.push(ringToLonLat(ring as [number, number][], bbox, lonStep, latStep));
          }
        }
      }
      if (paths.length > 0) contours.push({ level, paths });
    }
  }

  // Thiessen/Voronoi polygons: each station's area of representation, clipped to the bbox.
  const voronoi: InterpolateResponse["voronoi"] = [];
  if (existingStations.length > 0) {
    const delaunay = Delaunay.from(
      existingStations,
      (s) => s.lon,
      (s) => s.lat,
    );
    const diagram = delaunay.voronoi([lonMin, latMin, lonMax, latMax]);
    existingStations.forEach((station, i) => {
      const polygon = diagram.cellPolygon(i);
      if (polygon) voronoi.push({ stationId: station.id, polygon: polygon as [number, number][] });
    });
  }

  return {
    bbox,
    variable,
    start,
    end,
    unit: unitLabel(variable),
    minValue,
    maxValue,
    existingStations,
    voronoi,
    contours,
  };
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await withTimeout(computeInterpolation(parsed.data), REQUEST_TIMEOUT_MS);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RequestTimeoutError) {
      console.error("Interpolation query timed out:", err);
      return NextResponse.json(
        {
          error:
            "The interpolation took too long to run. Try a smaller grid size or a narrower coordinate box.",
        },
        { status: 504 },
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "Failed to compute interpolation" },
      { status: 500 },
    );
  }
}
