"use client";

import { VARIABLES, PRESETS } from "@/lib/types";
import type { FormState } from "@/lib/formState";

const VARIABLE_LABELS: Record<string, string> = {
  TMAX: "Max Temperature (TMAX)",
  TMIN: "Min Temperature (TMIN)",
  TAVG: "Average Temperature (TAVG)",
  PRCP: "Precipitation (PRCP)",
  SNOW: "Snowfall (SNOW)",
};

interface ControlPanelProps {
  value: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  loading: boolean;
}

const inputClass =
  "w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-[#0b0b0b] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2a78d6] dark:focus:ring-[#3987e5]";

const labelClass = "block text-xs font-medium text-[#52514e] dark:text-[#c3c2b7] mb-1";

export function ControlPanel({ value, onChange, onSubmit, loading }: ControlPanelProps) {
  function set<K extends keyof FormState>(key: K, v: FormState[K]) {
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
      start: preset.start,
      end: preset.end,
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
        <label className={labelClass} htmlFor="variable">
          Variable
        </label>
        <select
          id="variable"
          className={inputClass}
          value={value.variable}
          onChange={(e) => set("variable", e.target.value as FormState["variable"])}
        >
          {VARIABLES.map((v) => (
            <option key={v} value={v}>
              {VARIABLE_LABELS[v] ?? v}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="start">
            Start date
          </label>
          <input
            id="start"
            type="date"
            className={inputClass}
            value={value.start}
            max={value.end}
            onChange={(e) => set("start", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="end">
            End date
          </label>
          <input
            id="end"
            type="date"
            className={inputClass}
            value={value.end}
            min={value.start}
            onChange={(e) => set("end", e.target.value)}
          />
        </div>
      </div>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className={labelClass}>Coordinate box</legend>
        <div>
          <label className={labelClass} htmlFor="latMin">
            Latitude min
          </label>
          <input
            id="latMin"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.latMin}
            onChange={(e) => set("latMin", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="latMax">
            Latitude max
          </label>
          <input
            id="latMax"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.latMax}
            onChange={(e) => set("latMax", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lonMin">
            Longitude min
          </label>
          <input
            id="lonMin"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.lonMin}
            onChange={(e) => set("lonMin", Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lonMax">
            Longitude max
          </label>
          <input
            id="lonMax"
            type="number"
            step="0.1"
            className={inputClass}
            value={value.lonMax}
            onChange={(e) => set("lonMax", Number(e.target.value))}
          />
        </div>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="preset">
          Quick presets (past hurricanes)
        </label>
        <select
          id="preset"
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

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-[#2a78d6] dark:bg-[#3987e5] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? "Loading stations…" : "Search stations"}
      </button>
    </form>
  );
}
