import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getReferenceData } from "@/lib/ghcnReference";
import { VARIABLES, type OptimizeResponse } from "@/lib/types";
import { buildCandidateGrid } from "@/lib/optimization/grid";
import { isOnLand } from "@/lib/optimization/landMask";
import { passesOperationalFilter } from "@/lib/optimization/operationalFilter";
import { capActiveStations, greedyPlacement, scoreGrid } from "@/lib/optimization/placement";
import type { VariogramParams } from "@/lib/optimization/kriging";

const querySchema = z
  .object({
    variable: z.enum(VARIABLES),
    latMin: z.coerce.number().min(-90).max(90),
    latMax: z.coerce.number().min(-90).max(90),
    lonMin: z.coerce.number().min(-180).max(180),
    lonMax: z.coerce.number().min(-180).max(180),
    gridSize: z.coerce.number().int().min(4).max(32).default(16),
    numNewStations: z.coerce.number().int().min(1).max(15).default(5),
    rangeKm: z.coerce.number().min(5).max(2000).default(150),
    minDistanceKm: z.coerce.number().min(0).max(500).default(75),
  })
  .refine((v) => v.latMin <= v.latMax, {
    message: "latMin must be <= latMax",
    path: ["latMin"],
  })
  .refine((v) => v.lonMin <= v.lonMax, {
    message: "lonMin must be <= lonMax",
    path: ["lonMin"],
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

async function computeOptimization(
  params: z.infer<typeof querySchema>,
): Promise<OptimizeResponse> {
  const {
    variable,
    latMin,
    latMax,
    lonMin,
    lonMax,
    gridSize,
    numNewStations,
    rangeKm,
    minDistanceKm,
  } = params;
  const bbox = { latMin, latMax, lonMin, lonMax };

  const { stations, inventory } = await getReferenceData();

  // Stations just outside the bbox still inform kriging/filtering near its edges.
  const bufferDeg = Math.max(rangeKm, minDistanceKm) / 111;
  const nearby = stations.filter(
    (s) =>
      s.lat >= latMin - bufferDeg &&
      s.lat <= latMax + bufferDeg &&
      s.lon >= lonMin - bufferDeg &&
      s.lon <= lonMax + bufferDeg,
  );

  const currentYear = new Date().getUTCFullYear();
  const activeIds = new Set(
    inventory
      .filter((row) => row.element === variable && row.lastYear >= currentYear - 5)
      .map((row) => row.id),
  );
  const activeStations = nearby.filter((s) => activeIds.has(s.id));

  const center = { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 };
  const krigingStations = capActiveStations(activeStations, center);

  const variogram: VariogramParams = { rangeKm, partialSill: 1, nugget: 0.05 };

  const { cells, latStep, lonStep } = buildCandidateGrid(bbox, gridSize);
  const operationalMask = cells.map(
    (cell) =>
      isOnLand(cell) &&
      passesOperationalFilter(cell, nearby, { maxDistanceToInfrastructureKm: minDistanceKm }),
  );

  const scored = scoreGrid(krigingStations, cells, variogram, operationalMask);
  const recommended = greedyPlacement(
    krigingStations,
    cells,
    variogram,
    operationalMask,
    numNewStations,
  );

  return {
    bbox,
    variable,
    gridSize,
    cellLatSpan: latStep,
    cellLonSpan: lonStep,
    variogram,
    minDistanceKm,
    existingStations: activeStations.map((s) => ({
      id: s.id,
      lat: s.lat,
      lon: s.lon,
      name: s.name,
    })),
    grid: scored.map((c) => ({
      lat: c.lat,
      lon: c.lon,
      variance: c.variance,
      operational: c.operational,
    })),
    recommended: recommended.map((r) => ({
      rank: r.rank,
      lat: r.lat,
      lon: r.lon,
      score: r.score,
    })),
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
    const result = await withTimeout(computeOptimization(parsed.data), REQUEST_TIMEOUT_MS);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RequestTimeoutError) {
      console.error("Optimization query timed out:", err);
      return NextResponse.json(
        {
          error:
            "The optimization took too long to run. Try a smaller grid size, fewer new stations, or a narrower coordinate box.",
        },
        { status: 504 },
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "Failed to compute optimization" },
      { status: 500 },
    );
  }
}
