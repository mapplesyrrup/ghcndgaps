"use client";

import { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  BoundingBox,
  ContourLine,
  InterpolatedStationPoint,
  VoronoiCell,
} from "@/lib/types";
import { bandedColor } from "@/lib/colorScale";

// Matches components/StationMap.tsx / OptimizeMap.tsx so all three tabs look the same.
const BASEMAP_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://carto.com/about-carto/">CARTO</a>, © <a href="http://www.openstreetmap.org/about/">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "carto-layer",
      type: "raster" as const,
      source: "carto",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

interface InterpolateMapProps {
  bbox: BoundingBox;
  existingStations: InterpolatedStationPoint[];
  voronoi: VoronoiCell[];
  contours: ContourLine[];
  minValue: number;
  maxValue: number;
  unit: string;
}

interface HoverInfo {
  x: number;
  y: number;
  label: string;
  detail?: string;
}

interface ContourPathDatum {
  level: number;
  path: [number, number][];
}

interface ContourLabelDatum {
  level: number;
  position: [number, number];
}

function initialViewState(bbox: BoundingBox) {
  const lat = (bbox.latMin + bbox.latMax) / 2;
  const lon = (bbox.lonMin + bbox.lonMax) / 2;
  const latSpan = Math.max(bbox.latMax - bbox.latMin, 0.5);
  const lonSpan = Math.max(bbox.lonMax - bbox.lonMin, 0.5);
  const span = Math.max(latSpan, lonSpan);
  const zoom = Math.max(2, Math.min(9, 8 - Math.log2(span)));
  return { longitude: lon, latitude: lat, zoom, pitch: 0, bearing: 0 };
}

export function InterpolateMap({
  bbox,
  existingStations,
  voronoi,
  contours,
  minValue,
  maxValue,
  unit,
}: InterpolateMapProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const viewState = useMemo(() => initialViewState(bbox), [bbox]);

  // Same thresholds drive both the Voronoi fill bands and the isolines, so a cell's shade and
  // the contour lines crossing it agree with each other.
  const levels = useMemo(() => contours.map((c) => c.level), [contours]);

  const stationValueById = useMemo(
    () => new Map(existingStations.map((s) => [s.id, s.value])),
    [existingStations],
  );

  const contourPaths = useMemo<ContourPathDatum[]>(
    () => contours.flatMap((c) => c.paths.map((path) => ({ level: c.level, path }))),
    [contours],
  );

  // One label per level, anchored to the midpoint of that level's longest ring.
  const contourLabels = useMemo<ContourLabelDatum[]>(
    () =>
      contours.map((c) => {
        const longest = c.paths.reduce((a, b) => (b.length > a.length ? b : a), c.paths[0]);
        return { level: c.level, position: longest[Math.floor(longest.length / 2)] };
      }),
    [contours],
  );

  const layers = [
    new PolygonLayer<VoronoiCell>({
      id: "voronoi-cells",
      data: voronoi,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => {
        const value = stationValueById.get(d.stationId);
        return value === undefined ? [200, 198, 190, 60] : [...bandedColor(value, levels), 210];
      },
      getLineColor: [255, 255, 255, 130],
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          const value = stationValueById.get(info.object.stationId);
          setHover({
            x: info.x,
            y: info.y,
            label: "Area of representation",
            detail: value === undefined ? undefined : `${value.toFixed(1)} ${unit}`,
          });
        } else {
          setHover(null);
        }
      },
    }),
    new PathLayer<ContourPathDatum>({
      id: "contour-lines",
      data: contourPaths,
      getPath: (d) => d.path,
      getColor: [60, 58, 54, 200],
      getWidth: 1,
      widthUnits: "pixels",
      widthMinPixels: 1,
      pickable: false,
    }),
    new TextLayer<ContourLabelDatum>({
      id: "contour-labels",
      data: contourLabels,
      getPosition: (d) => d.position,
      getText: (d) => d.level.toFixed(1),
      getSize: 10,
      getColor: [40, 38, 34, 255],
      background: true,
      getBackgroundColor: [255, 255, 255, 210],
      backgroundPadding: [3, 1],
      fontFamily: "Arial, Helvetica, sans-serif",
      pickable: false,
    }),
    new ScatterplotLayer<InterpolatedStationPoint>({
      id: "existing-stations",
      data: existingStations,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: [30, 41, 59, 235],
      getRadius: 1,
      radiusUnits: "pixels",
      radiusMinPixels: 3,
      radiusMaxPixels: 5,
      stroked: true,
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHover({
            x: info.x,
            y: info.y,
            label: info.object.name || info.object.id,
            detail: `observed ${info.object.value.toFixed(1)} ${unit}`,
          });
        } else {
          setHover(null);
        }
      },
    }),
  ];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      <DeckGL
        initialViewState={viewState}
        controller
        layers={layers}
        getCursor={() => (hover ? "pointer" : "grab")}
      >
        <MapLibreMap mapStyle={BASEMAP_STYLE} />
      </DeckGL>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a19] px-3 py-2 text-xs shadow-lg text-[#0b0b0b] dark:text-white"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-medium">{hover.label}</div>
          {hover.detail && (
            <div className="text-[#52514e] dark:text-[#c3c2b7]">{hover.detail}</div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1.5 rounded-md border border-black/10 dark:border-white/15 bg-white/90 dark:bg-[#1a1a19]/90 px-2.5 py-1.5 text-[10px] text-[#52514e] dark:text-[#c3c2b7]">
        <div>
          <div className="mb-1 font-medium text-[#0b0b0b] dark:text-white">
            {unit ? `Value (${unit})` : "Value"}
          </div>
          <div
            className="h-2 w-32 rounded-sm"
            style={{ background: "linear-gradient(to right, #cde2fb, #2a78d6, #0d366b)" }}
          />
          <div className="mt-0.5 flex justify-between">
            <span>{minValue.toFixed(1)}</span>
            <span>{maxValue.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-[#1e293b]" />
          existing station
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4 bg-[#3c3a36]" />
          contour line (interpolated isoline)
        </div>
      </div>
    </div>
  );
}
