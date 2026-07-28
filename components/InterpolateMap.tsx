"use client";

import { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BoundingBox, InterpolatedCell, InterpolatedStationPoint } from "@/lib/types";
import { valueToColor } from "@/lib/colorScale";

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
  grid: InterpolatedCell[];
  cellLatSpan: number;
  cellLonSpan: number;
  unit: string;
}

interface HoverInfo {
  x: number;
  y: number;
  label: string;
  detail?: string;
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
  grid,
  cellLatSpan,
  cellLonSpan,
  unit,
}: InterpolateMapProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const viewState = useMemo(() => initialViewState(bbox), [bbox]);

  // Scale both the grid and the station markers off the same [min, max] so a station's dot
  // color lines up with the interpolated surface color right underneath it.
  const [minValue, maxValue] = useMemo(() => {
    const values = [...grid.map((c) => c.estimate), ...existingStations.map((s) => s.value)];
    if (values.length === 0) return [0, 1];
    return [Math.min(...values), Math.max(...values)];
  }, [grid, existingStations]);

  const cellRadiusMeters = useMemo(() => {
    const centerLat = (bbox.latMin + bbox.latMax) / 2;
    const latMeters = cellLatSpan * 111_320;
    const lonMeters = cellLonSpan * 111_320 * Math.cos((centerLat * Math.PI) / 180);
    return (Math.min(latMeters, lonMeters) / 2) * 0.9;
  }, [bbox, cellLatSpan, cellLonSpan]);

  const layers = [
    new ScatterplotLayer<InterpolatedCell>({
      id: "interpolated-cells",
      data: grid,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => [...valueToColor(d.estimate, minValue, maxValue), 190],
      getRadius: cellRadiusMeters,
      radiusUnits: "meters",
      stroked: false,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHover({
            x: info.x,
            y: info.y,
            label: "Interpolated value",
            detail: `${info.object.estimate.toFixed(1)} ${unit}`,
          });
        } else {
          setHover(null);
        }
      },
    }),
    new ScatterplotLayer<InterpolatedStationPoint>({
      id: "existing-stations",
      data: existingStations,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => [...valueToColor(d.value, minValue, maxValue), 255],
      getRadius: 1,
      radiusUnits: "pixels",
      radiusMinPixels: 4,
      radiusMaxPixels: 8,
      stroked: true,
      getLineColor: [11, 11, 11, 220],
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
            {unit ? `Interpolated value (${unit})` : "Interpolated value"}
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
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-black bg-[#6da7ec]" />
          existing station (observed value)
        </div>
      </div>
    </div>
  );
}
