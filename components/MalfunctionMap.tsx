"use client";

import { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MalfunctionStationResult, BoundingBox } from "@/lib/types";
import { missingPctToColor } from "@/lib/colorScale";

// Matches components/StationMap.tsx so both tabs look the same.
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

interface MalfunctionMapProps {
  stations: MalfunctionStationResult[];
  bbox: BoundingBox;
}

interface HoverInfo {
  x: number;
  y: number;
  station: MalfunctionStationResult;
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

const FLAGGED_OUTLINE: [number, number, number, number] = [211, 59, 59, 255];
const NORMAL_OUTLINE: [number, number, number, number] = [11, 11, 11, 120];

export function MalfunctionMap({ stations, bbox }: MalfunctionMapProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const viewState = useMemo(() => initialViewState(bbox), [bbox]);

  const layers = [
    new ScatterplotLayer<MalfunctionStationResult>({
      id: "stations",
      data: stations,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => [...missingPctToColor(d.suspectPct), 220],
      getRadius: 1,
      radiusUnits: "pixels",
      radiusMinPixels: 5,
      radiusMaxPixels: 14,
      stroked: true,
      getLineColor: (d) => (d.likelyMalfunctioning ? FLAGGED_OUTLINE : NORMAL_OUTLINE),
      getLineWidth: (d) => (d.likelyMalfunctioning ? 2 : 1),
      lineWidthMinPixels: 1,
      lineWidthMaxPixels: 3,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHover({ x: info.x, y: info.y, station: info.object });
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
          <div className="font-medium">{hover.station.name || hover.station.id}</div>
          <div className="text-[#52514e] dark:text-[#c3c2b7]">{hover.station.id}</div>
          <div className="mt-1">
            <span className="font-medium">{hover.station.suspectPct}%</span> suspect (
            {hover.station.suspectDays}/{hover.station.daysChecked} checked days)
          </div>
          {hover.station.likelyMalfunctioning && (
            <div className="mt-1 font-medium text-[#d33b3b]">Likely malfunctioning</div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-10 rounded-md border border-black/10 dark:border-white/15 bg-white/90 dark:bg-[#1a1a19]/90 px-2.5 py-1.5 text-[10px] text-[#52514e] dark:text-[#c3c2b7]">
        <div className="mb-1 font-medium text-[#0b0b0b] dark:text-white">
          % days flagged suspect (vs. neighbors)
        </div>
        <div
          className="h-2 w-32 rounded-sm"
          style={{
            background: "linear-gradient(to right, #cde2fb, #2a78d6, #0d366b)",
          }}
        />
        <div className="mt-0.5 flex justify-between">
          <span>0%</span>
          <span>100%</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#d33b3b] bg-transparent" />
          likely malfunctioning (≥20% suspect days)
        </div>
      </div>
    </div>
  );
}
