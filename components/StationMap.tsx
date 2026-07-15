"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map as MapLibreMap, type MapRef } from "react-map-gl/maplibre";
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
  const viewState = useMemo(() => initialViewState(bbox), [bbox]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // MapLibre reads its container's size once at construction (or when .resize()
  // is called) — it does not auto-follow later CSS/prop size changes on its own,
  // so re-measuring the container isn't enough; the map must be told explicitly.
  useEffect(() => {
    mapRef.current?.resize();
  }, [size]);

  // react-map-gl/deck.gl can collapse to a 0/300x150 fallback when nested inside
  // this flex layout (percentage sizing through an absolutely-positioned wrapper
  // with no positioned ancestor resolves unreliably). Measuring the container
  // in JS and passing explicit pixel sizes sidesteps that entirely.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    // The container can measure incorrectly on the very first effect pass
    // (before the flex layout has fully settled), and neither requestAnimationFrame
    // nor ResizeObserver's initial callback are guaranteed to fire promptly in
    // every rendering context (e.g. a backgrounded/throttled tab). setTimeout
    // retries are the one scheduling primitive that reliably still fires there,
    // so use those to self-correct shortly after mount.
    measure();
    const timers = [50, 200, 500, 1000].map((delay) => setTimeout(measure, delay));

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const layers = [
    new ScatterplotLayer<StationResult>({
      id: "stations",
      data: stations,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: (d) => [...missingPctToColor(d.missingPct), 220],
      getRadius: 1,
      radiusUnits: "pixels",
      radiusMinPixels: 5,
      radiusMaxPixels: 14,
      stroked: true,
      getLineColor: [11, 11, 11, 120],
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
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
    >
      {size && size.width > 0 && size.height > 0 && (
        <DeckGL
          width={size.width}
          height={size.height}
          initialViewState={viewState}
          controller
          layers={layers}
          getCursor={() => (hover ? "pointer" : "grab")}
        >
          <MapLibreMap
            ref={mapRef}
            mapStyle={BASEMAP_STYLE}
            style={{ width: size.width, height: size.height }}
            onLoad={() => mapRef.current?.resize()}
          />
        </DeckGL>
      )}

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
      </div>
    </div>
  );
}
