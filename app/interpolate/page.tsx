"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InterpolateControlPanel } from "@/components/InterpolateControlPanel";
import { InterpolateMap } from "@/components/InterpolateMap";
import {
  defaultInterpolateFormState,
  type InterpolateFormState,
} from "@/lib/interpolateFormState";
import type { InterpolateResponse } from "@/lib/types";

export default function InterpolatePage() {
  const [form, setForm] = useState<InterpolateFormState>(() => defaultInterpolateFormState());
  const [data, setData] = useState<InterpolateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const runQuery = useCallback((query: InterpolateFormState) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      variable: query.variable,
      start: query.start,
      end: query.end,
      latMin: String(query.latMin),
      latMax: String(query.latMax),
      lonMin: String(query.lonMin),
      lonMax: String(query.lonMax),
      gridSize: String(query.gridSize),
      rangeKm: String(query.rangeKm),
      contourLevels: String(query.contourLevels),
    });

    fetch(`/api/interpolate?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Request failed");
        return body as InterpolateResponse;
      })
      .then((body) => {
        if (id !== requestId.current) return;
        setData(body);
      })
      .catch((err: Error) => {
        if (id !== requestId.current) return;
        setError(err.message);
        setData(null);
      })
      .finally(() => {
        if (id !== requestId.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runQuery(form), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f9f9f7] dark:bg-[#0d0d0d]">
      <header className="border-b border-black/10 dark:border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold text-[#0b0b0b] dark:text-white">Interpolation</h1>
        <p className="text-sm text-[#52514e] dark:text-[#c3c2b7]">
          Ordinary kriging estimate of the field value (Amorim et al. 2012) from real GHCN-D
          observations, averaged over the date range and reconstructed across the region.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        <div className="lg:w-80 lg:shrink-0">
          <InterpolateControlPanel
            value={form}
            onChange={setForm}
            onSubmit={() => runQuery(form)}
            loading={loading}
          />
          {error && (
            <div className="mt-3 rounded-md border border-[#d03b3b]/30 bg-[#d03b3b]/10 px-3 py-2 text-sm text-[#d03b3b]">
              {error}
            </div>
          )}
          {data && !error && (
            <div className="mt-3 text-xs text-[#898781]">
              {data.existingStations.length} station
              {data.existingStations.length === 1 ? "" : "s"} with data · {data.contours.length}{" "}
              contour line{data.contours.length === 1 ? "" : "s"}
            </div>
          )}
          {data && !error && data.existingStations.length === 0 && (
            <div className="mt-3 rounded-md border border-dashed border-black/15 dark:border-white/15 px-3 py-2 text-[11px] leading-relaxed text-[#898781]">
              No stations in this box reported {data.variable} across the whole date range —
              widen the box or date range.
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:min-h-0">
          <div className="h-[420px] flex-1 lg:min-h-0">
            <InterpolateMap
              bbox={form}
              existingStations={data?.existingStations ?? []}
              voronoi={data?.voronoi ?? []}
              contours={data?.contours ?? []}
              minValue={data?.minValue ?? 0}
              maxValue={data?.maxValue ?? 1}
              unit={data?.unit ?? ""}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
