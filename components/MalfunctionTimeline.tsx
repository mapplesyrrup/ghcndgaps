"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MalfunctionDailySummary } from "@/lib/types";

interface MalfunctionTimelineProps {
  daily: MalfunctionDailySummary[];
}

const LINE_COLOR = "#2a78d6";
const GRID_COLOR = "#e1e0d9";
const MUTED_TEXT = "#898781";

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MalfunctionDailySummary }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a19] px-3 py-2 text-xs shadow-lg text-[#0b0b0b] dark:text-white">
      <div className="font-medium">{label ? formatDate(label) : ""}</div>
      <div className="mt-1">
        <span className="font-medium">{d.suspectPct}%</span> flagged suspect
      </div>
      <div className="text-[#52514e] dark:text-[#c3c2b7]">
        {d.suspectStations} of {d.stationsChecked} checked stations
      </div>
    </div>
  );
}

export function MalfunctionTimeline({ daily }: MalfunctionTimelineProps) {
  return (
    <div className="h-full w-full rounded-lg border border-black/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1a1a19] p-3">
      <h3 className="mb-2 text-xs font-medium text-[#52514e] dark:text-[#c3c2b7]">
        % of checked stations flagged suspect, per day
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={daily} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: MUTED_TEXT }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: MUTED_TEXT }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="suspectPct"
            stroke={LINE_COLOR}
            strokeWidth={2}
            fill={LINE_COLOR}
            fillOpacity={0.1}
            dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: LINE_COLOR, strokeWidth: 2, stroke: "#fcfcfb" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
