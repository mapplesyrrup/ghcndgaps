"use client";

import { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StationResult, BoundingBox } from "@/lib/types";
import { missingPctToColor } from "@/lib/colorScale";

// A self-contained raster style (no external style.json/glyph/sprite fetches) —
// more resilient than the vector "positron-gl-style" to flaky CDN shards.
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

interface StationMapProps {
  stations: StationResult[];
  bbox: BoundingBox;
}

interface HoverInfo {
  x: number;
  y: number;
  station: StationResult;
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

export function StationMap({ stations, bbox }: StationMapProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [showStations, setShowStations] = useState(true);
  const viewState = useMemo(() => initialViewState(bbox), [bbox]);

  const layers = [
    new ScatterplotLayer<StationResult>({
      id: "stations",
      data: stations,
      visible: showStations,
      getPosition: (d) => [d.lon, d.lat],
      // Fully-reporting stations (0% missing) are the majority in most queries and aren't
      // the interesting case, so fade and shrink them to let stations with actual gaps stand out.
      getFillColor: (d) => [...missingPctToColor(d.missingPct), d.missingPct === 0 ? 90 : 220],
      getRadius: (d) => (d.missingPct === 0 ? 4 : 7),
      radiusUnits: "pixels",
      radiusMinPixels: 3,
      radiusMaxPixels: 14,
      stroked: true,
      getLineColor: (d) => (d.missingPct === 0 ? [11, 11, 11, 60] : [11, 11, 11, 120]),
      lineWidthMinPixels: 1,
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

      <button
        type="button"
        onClick={() => setShowStations((v) => !v)}
        className="absolute top-2 right-2 z-10 rounded-md border border-black/10 dark:border-white/15 bg-white/90 dark:bg-[#1a1a19]/90 px-2.5 py-1.5 text-xs font-medium text-[#0b0b0b] dark:text-white shadow-sm hover:bg-white dark:hover:bg-[#1a1a19]"
      >
        {showStations ? "Hide stations" : "Show stations"}
      </button>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a19] px-3 py-2 text-xs shadow-lg text-[#0b0b0b] dark:text-white"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-medium">{hover.station.name || hover.station.id}</div>
          <div className="text-[#52514e] dark:text-[#c3c2b7]">{hover.station.id}</div>
          <div className="mt-1">
            <span className="font-medium">{hover.station.missingPct}%</span> missing (
            {hover.station.missingDays}/{hover.station.totalDays} days)
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-10 rounded-md border border-black/10 dark:border-white/15 bg-white/90 dark:bg-[#1a1a19]/90 px-2.5 py-1.5 text-[10px] text-[#52514e] dark:text-[#c3c2b7]">
        <div className="mb-1 font-medium text-[#0b0b0b] dark:text-white">% days missing</div>
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
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#cde2fb] opacity-60" />
          0% missing (smaller, fainter)
        </div>
      </div>
    </div>
  );
}
