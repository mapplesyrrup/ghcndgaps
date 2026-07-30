"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { MalfunctionMap } from "@/components/MalfunctionMap";
import { MalfunctionTimeline } from "@/components/MalfunctionTimeline";
import { MalfunctionTable } from "@/components/MalfunctionTable";
import { defaultFormState, type FormState } from "@/lib/formState";
import type { MalfunctionResponse } from "@/lib/types";

export default function MalfunctionPage() {
  const [form, setForm] = useState<FormState>(() => defaultFormState());
  const [data, setData] = useState<MalfunctionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const runQuery = useCallback((query: FormState) => {
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
    });

    fetch(`/api/malfunction?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Request failed");
        return body as MalfunctionResponse;
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
    // Auto-fetch once on load with the default query; subsequent runs are user-triggered.
    // Deferred so the initial setState doesn't run synchronously within the effect body.
    const timer = setTimeout(() => runQuery(form), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flaggedCount = data?.stations.filter((s) => s.likelyMalfunctioning).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f9f9f7] dark:bg-[#0d0d0d]">
      <header className="border-b border-black/10 dark:border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold text-[#0b0b0b] dark:text-white">
          Malfunction Detection
        </h1>
        <p className="text-sm text-[#52514e] dark:text-[#c3c2b7]">
          Flags stations whose readings disagree with their neighbors: each day, a station&apos;s
          expected value is estimated from nearby stations (inverse-distance weighted, within
          100 km), and a reading is &quot;suspect&quot; if it&apos;s a robust statistical outlier
          against that estimate.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        <div className="lg:w-80 lg:shrink-0">
          <ControlPanel
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
              {data.stationCount} station{data.stationCount === 1 ? "" : "s"} checked ·{" "}
              {flaggedCount} likely malfunctioning · {data.start} to {data.end}
            </div>
          )}
          <div className="mt-3 rounded-md border border-dashed border-black/15 dark:border-white/15 px-3 py-2 text-[11px] leading-relaxed text-[#898781]">
            A station needs at least 3 neighbors within 100 km reporting the same day to be
            checked at all, so sparse regions will show fewer &quot;days checked&quot; than the
            full date range.
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:min-h-0">
          <div className="h-[420px] lg:h-2/3 lg:min-h-0">
            <MalfunctionMap stations={data?.stations ?? []} bbox={form} />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-2">
            <div className="h-64 lg:h-full">
              <MalfunctionTimeline daily={data?.daily ?? []} />
            </div>
            <div className="h-64 lg:h-full">
              <MalfunctionTable stations={data?.stations ?? []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
