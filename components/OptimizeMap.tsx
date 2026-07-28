"use client";

import { useMemo, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  BoundingBox,
  ExistingStationPoint,
  RecommendedSite,
  UncertaintyCell,
} from "@/lib/types";
import { ratioToColor } from "@/lib/colorScale";
import { hexagonPolygon } from "@/lib/hexGeometry";

// Self-contained raster style — matches components/StationMap.tsx so both tabs look the same
// and neither depends on a vector style.json / glyph / sprite fetch from a CDN.
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

interface OptimizeMapProps {
  bbox: BoundingBox;
  existingStations: ExistingStationPoint[];
  grid: UncertaintyCell[];
  cellLatSpan: number;
  cellLonSpan: number;
  recommended: RecommendedSite[];
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

export function OptimizeMap({
  bbox,
  existingStations,
  grid,
  cellLatSpan,
  cellLonSpan,
  recommended,
}: OptimizeMapProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const viewState = useMemo(() => initialViewState(bbox), [bbox]);

  const maxVariance = useMemo(
    () => grid.reduce((m, c) => Math.max(m, c.variance), 0) || 1,
    [grid],
  );

  // Hexagon "radius" (center to vertex) in meters. Flat-to-flat width is radius * sqrt(3), so
  // sizing off the tighter of lat/lon spacing with a bit of overlap keeps the hex tiling
  // gapless across the square candidate lattice instead of leaving diamond-shaped holes.
  const cellRadiusMeters = useMemo(() => {
    const centerLat = (bbox.latMin + bbox.latMax) / 2;
    const latMeters = cellLatSpan * 111_320;
    const lonMeters = cellLonSpan * 111_320 * Math.cos((centerLat * Math.PI) / 180);
    return Math.min(latMeters, lonMeters) * 0.6;
  }, [bbox, cellLatSpan, cellLonSpan]);

  const operationalCells = useMemo(() => grid.filter((c) => c.operational), [grid]);
  const filteredCells = useMemo(() => grid.filter((c) => !c.operational), [grid]);

  const layers = [
    new PolygonLayer<UncertaintyCell>({
      id: "filtered-out-cells",
      data: filteredCells,
      getPolygon: (d) => hexagonPolygon(d, cellRadiusMeters),
      getFillColor: [180, 178, 170, 60],
      stroked: false,
      pickable: false,
    }),
    new PolygonLayer<UncertaintyCell>({
      id: "uncertainty-cells",
      data: operationalCells,
      getPolygon: (d) => hexagonPolygon(d, cellRadiusMeters),
      getFillColor: (d) => [...ratioToColor(d.variance / maxVariance), 190],
      stroked: false,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHover({
            x: info.x,
            y: info.y,
            label: "Candidate site",
            detail: `uncertainty ${info.object.variance.toFixed(3)}`,
          });
        } else {
          setHover(null);
        }
      },
    }),
    new ScatterplotLayer<ExistingStationPoint>({
      id: "existing-stations",
      data: existingStations,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: [80, 80, 78, 230],
      getRadius: 1,
      radiusUnits: "pixels",
      radiusMinPixels: 3,
      radiusMaxPixels: 6,
      stroked: true,
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHover({
            x: info.x,
            y: info.y,
            label: info.object.name || info.object.id,
            detail: "existing station",
          });
        } else {
          setHover(null);
        }
      },
    }),
    new ScatterplotLayer<RecommendedSite>({
      id: "recommended-sites",
      data: recommended,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: [217, 119, 6, 230],
      getRadius: 1,
      radiusUnits: "pixels",
      radiusMinPixels: 8,
      radiusMaxPixels: 16,
      stroked: true,
      getLineColor: [11, 11, 11, 230],
      lineWidthMinPixels: 1.5,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHover({
            x: info.x,
            y: info.y,
            label: `Recommended site #${info.object.rank}`,
            detail: `score ${info.object.score.toFixed(3)}`,
          });
        } else {
          setHover(null);
        }
      },
    }),
    new TextLayer<RecommendedSite>({
      id: "recommended-labels",
      data: recommended,
      getPosition: (d) => [d.lon, d.lat],
      getText: (d) => String(d.rank),
      getSize: 11,
      getColor: [255, 255, 255, 255],
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: "bold",
      pickable: false,
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
            Coverage uncertainty
          </div>
          <div
            className="h-2 w-32 rounded-sm"
            style={{ background: "linear-gradient(to right, #cde2fb, #2a78d6, #0d366b)" }}
          />
          <div className="mt-0.5 flex justify-between">
            <span>low</span>
            <span>high</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-[#504f4e]" />
          existing station
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-black bg-[#d97706]" />
          recommended new site
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#b4b2aa]/60" />
          filtered out (water, or too far from infrastructure)
        </div>
      </div>
    </div>
  );
}
