"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OptimizeControlPanel } from "@/components/OptimizeControlPanel";
import { OptimizeMap } from "@/components/OptimizeMap";
import { OptimizeResultsTable } from "@/components/OptimizeResultsTable";
import { defaultOptimizeFormState, type OptimizeFormState } from "@/lib/optimizeFormState";
import type { OptimizeResponse } from "@/lib/types";

export default function OptimizePage() {
  const [form, setForm] = useState<OptimizeFormState>(() => defaultOptimizeFormState());
  const [data, setData] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const runQuery = useCallback((query: OptimizeFormState) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      variable: query.variable,
      latMin: String(query.latMin),
      latMax: String(query.latMax),
      lonMin: String(query.lonMin),
      lonMax: String(query.lonMax),
      gridSize: String(query.gridSize),
      numNewStations: String(query.numNewStations),
      rangeKm: String(query.rangeKm),
      minDistanceKm: String(query.minDistanceKm),
    });

    fetch(`/api/optimize?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Request failed");
        return body as OptimizeResponse;
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
        <h1 className="text-lg font-semibold text-[#0b0b0b] dark:text-white">
          Optimization of Weather Station Placement
        </h1>
        <p className="text-sm text-[#52514e] dark:text-[#c3c2b7]">
          Kriging uncertainty surface (Amorim et al. 2012) over the existing GHCN-D network,
          filtered by an accessibility proxy (Snyder 2018) and expanded greedily to the sites
          that cut the most remaining coverage uncertainty.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        <div className="lg:w-80 lg:shrink-0">
          <OptimizeControlPanel
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
              {data.existingStations.length} existing station
              {data.existingStations.length === 1 ? "" : "s"} informing the surface ·{" "}
              {data.grid.filter((c) => c.operational).length}/{data.grid.length} candidate
              cells passed the accessibility filter
            </div>
          )}
          <div className="mt-3 rounded-md border border-dashed border-black/15 dark:border-white/15 px-3 py-2 text-[11px] leading-relaxed text-[#898781]">
            Siting quality (physical obstructions, heat sources, land cover) isn&apos;t scored
            yet — no GIS layer is wired up. Scores currently reflect coverage uncertainty ×
            the accessibility filter only.
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:min-h-0">
          <div className="h-[420px] lg:h-2/3 lg:min-h-0">
            <OptimizeMap
              bbox={form}
              existingStations={data?.existingStations ?? []}
              grid={data?.grid ?? []}
              cellLatSpan={data?.cellLatSpan ?? 1}
              cellLonSpan={data?.cellLonSpan ?? 1}
              recommended={data?.recommended ?? []}
            />
          </div>
          <div className="h-64 lg:h-1/3 lg:min-h-0">
            <OptimizeResultsTable sites={data?.recommended ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
