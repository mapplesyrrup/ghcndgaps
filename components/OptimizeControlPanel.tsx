"use client";

import { VARIABLES, PRESETS } from "@/lib/types";
import type { OptimizeFormState } from "@/lib/optimizeFormState";

const VARIABLE_LABELS: Record<string, string> = {
  TMAX: "Max Temperature (TMAX)",
  TMIN: "Min Temperature (TMIN)",
  TAVG: "Average Temperature (TAVG)",
  PRCP: "Precipitation (PRCP)",
  SNOW: "Snowfall (SNOW)",
};

interface OptimizeControlPanelProps {
  value: OptimizeFormState;
  onChange: (next: OptimizeFormState) => void;
  onSubmit: () => void;
  loading: boolean;
}

const inputClass =
  "w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-[#0b0b0b] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2a78d6] dark:focus:ring-[#3987e5]";

const labelClass = "block text-xs font-medium text-[#52514e] dark:text-[#c3c2b7] mb-1";

export function OptimizeControlPanel({
  value,
  onChange,
  onSubmit,
  loading,
}: OptimizeControlPanelProps) {
  function set<K extends keyof OptimizeFormState>(key: K, v: OptimizeFormState[K]) {
    onChange({ ...value, [key]: v });
  }

  function applyPreset(name: string) {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset) return;
    onChange({
      ...value,
      latMin: preset.latMin,
      latMax: preset.latMax,
      lonMin: preset.lonMin,
      lonMax: preset.lonMax,
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4 rounded-lg border border-black/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1a1a19] p-4"
    >
      <div>
        <label className={labelClass} htmlFor="opt-variable">
          Variable
        </label>
        <select
          id="opt-variable"
          className={inputClass}
          value={value.variable}
          onChange={(e) => set("variable", e.target.value as OptimizeFormState["variable"])}
        >
          {VARIABLES.map((v) => (
            <option key={v} value={v}>
              {VARIABLE_LABELS[v] ?? v}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className={labelClass}>Coordinate box</legend>
        <div>
          <label className={labelClass} htmlFor="opt-latMin">
            Latitude min
          </label>
          <input
            id="opt-latMin"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.latMin}
            onChange={(e) => set("latMin", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="opt-latMax">
            Latitude max
          </label>
          <input
            id="opt-latMax"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.latMax}
            onChange={(e) => set("latMax", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="opt-lonMin">
            Longitude min
          </label>
          <input
            id="opt-lonMin"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.lonMin}
            onChange={(e) => set("lonMin", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="opt-lonMax">
            Longitude max
          </label>
          <input
            id="opt-lonMax"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.lonMax}
            onChange={(e) => set("lonMax", Number(e.target.value))}
          />
        </div>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="opt-preset">
          Quick presets (past hurricanes)
        </label>
        <select
          id="opt-preset"
          className={inputClass}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) applyPreset(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Jump to a case study&hellip;
          </option>
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="opt-numNewStations">
            New stations to place
          </label>
          <input
            id="opt-numNewStations"
            type="number"
            min={1}
            max={15}
            className={inputClass}
            value={value.numNewStations}
            onChange={(e) => set("numNewStations", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="opt-gridSize">
            Grid resolution (per side)
          </label>
          <input
            id="opt-gridSize"
            type="number"
            min={4}
            max={32}
            className={inputClass}
            value={value.gridSize}
            onChange={(e) => set("gridSize", Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="opt-rangeKm">
          Variogram range — spatial correlation length ({value.rangeKm} km)
        </label>
        <input
          id="opt-rangeKm"
          type="range"
          min={25}
          max={500}
          step={25}
          className="w-full accent-[#2a78d6]"
          value={value.rangeKm}
          onChange={(e) => set("rangeKm", Number(e.target.value))}
        />
        <p className="mt-1 text-[11px] text-[#898781]">
          How far a station&apos;s coverage is assumed to reach before uncertainty grows.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="opt-minDistanceKm">
          Operational filter — max distance to existing infrastructure ({value.minDistanceKm}{" "}
          km)
        </label>
        <input
          id="opt-minDistanceKm"
          type="range"
          min={0}
          max={300}
          step={25}
          className="w-full accent-[#2a78d6]"
          value={value.minDistanceKm}
          onChange={(e) => set("minDistanceKm", Number(e.target.value))}
        />
        <p className="mt-1 text-[11px] text-[#898781]">
          Candidate sites farther than this from any known station are dropped before
          scoring (proxy for road access / maintainability — see note on the results panel).
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[#2a78d6] dark:bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? "Optimizing…" : "Run optimization"}
      </button>
    </form>
  );
}
