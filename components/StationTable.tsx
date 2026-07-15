"use client";

import { useMemo, useState } from "react";
import type { StationResult } from "@/lib/types";
import { missingPctToColor } from "@/lib/colorScale";

type SortKey = "name" | "missingPct" | "id";

interface StationTableProps {
  stations: StationResult[];
}

export function StationTable({ stations }: StationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("missingPct");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...stations];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "id") cmp = a.id.localeCompare(b.id);
      else cmp = a.missingPct - b.missingPct;
      return sortDesc ? -cmp : cmp;
    });
    return copy;
  }, [stations, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function headerButton(key: SortKey, label: string) {
    const active = key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide ${
          active
            ? "text-[#0b0b0b] dark:text-white"
            : "text-[#898781] hover:text-[#52514e] dark:hover:text-[#c3c2b7]"
        }`}
      >
        {label}
        {active && <span>{sortDesc ? "↓" : "↑"}</span>}
      </button>
    );
  }

  return (
    <div className="h-full w-full overflow-auto rounded-lg border border-black/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1a1a19]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-[#fcfcfb] dark:bg-[#1a1a19]">
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="px-3 py-2">{headerButton("id", "Station")}</th>
            <th className="px-3 py-2">{headerButton("name", "Name")}</th>
            <th className="px-3 py-2 text-right">{headerButton("missingPct", "Missing %")}</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs [font-variant-numeric:tabular-nums]">
          {sorted.map((s) => {
            const [r, g, b] = missingPctToColor(s.missingPct);
            return (
              <tr
                key={s.id}
                className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              >
                <td className="px-3 py-1.5 text-[#52514e] dark:text-[#c3c2b7]">{s.id}</td>
                <td className="px-3 py-1.5 font-sans text-[#0b0b0b] dark:text-white">
                  {s.name || "—"}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: `rgb(${r},${g},${b})` }}
                    />
                    {s.missingPct}%
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-[#898781]">
                No stations to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
