"use client";

import type { RecommendedSite } from "@/lib/types";

interface OptimizeResultsTableProps {
  sites: RecommendedSite[];
}

export function OptimizeResultsTable({ sites }: OptimizeResultsTableProps) {
  return (
    <div className="h-full w-full overflow-auto rounded-lg border border-black/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1a1a19]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-[#fcfcfb] dark:bg-[#1a1a19]">
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[#898781]">
              Rank
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[#898781]">
              Latitude
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[#898781]">
              Longitude
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-[#898781]">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs [font-variant-numeric:tabular-nums]">
          {sites.map((s) => (
            <tr
              key={s.rank}
              className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <td className="px-3 py-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d97706] font-sans text-[11px] font-semibold text-white">
                  {s.rank}
                </span>
              </td>
              <td className="px-3 py-1.5 text-[#0b0b0b] dark:text-white">{s.lat.toFixed(3)}</td>
              <td className="px-3 py-1.5 text-[#0b0b0b] dark:text-white">{s.lon.toFixed(3)}</td>
              <td className="px-3 py-1.5 text-right text-[#52514e] dark:text-[#c3c2b7]">
                {s.score.toFixed(3)}
              </td>
            </tr>
          ))}
          {sites.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-[#898781]">
                No candidate sites — run an optimization first.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
