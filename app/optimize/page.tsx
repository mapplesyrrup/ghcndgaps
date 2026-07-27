const FACTORS = [
  {
    name: "Representativeness",
    description:
      "How well a candidate site fills a gap in the network's coverage. Estimated via a kriging uncertainty surface (Amorim et al. 2018) or time-series-distance interpolation (Snyder 2018) — sites in poorly-estimated regions score higher.",
  },
  {
    name: "Siting quality",
    description:
      "Physical suitability of the site itself: obstructions, heat sources, land cover, slope. Scored against WMO / Brown-Russell siting rules as a penalty layer.",
  },
  {
    name: "Operational reliability",
    description:
      "Practical maintainability of the site: road access, nearby population for upkeep, cell coverage. Used as a pre-filter (Snyder 2018) to cut the candidate pool before scoring.",
  },
];

export default function OptimizePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f9f9f7] dark:bg-[#0d0d0d]">
      <header className="border-b border-black/10 dark:border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold text-[#0b0b0b] dark:text-white">
          Optimization of Weather Station Placement
        </h1>
        <p className="text-sm text-[#52514e] dark:text-[#c3c2b7]">
          Candidate site selection for new stations, combining coverage optimization with
          physical siting and operational constraints.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="rounded-lg border border-dashed border-black/15 dark:border-white/15 bg-[#fcfcfb] dark:bg-[#1a1a19] p-4 text-sm text-[#52514e] dark:text-[#c3c2b7]">
          This tab is scaffolded but not yet wired up — the map, candidate ranking, and
          optimization run controls will live here.
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FACTORS.map((factor) => (
            <div
              key={factor.name}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-[#fcfcfb] dark:bg-[#1a1a19] p-4"
            >
              <h2 className="text-sm font-medium text-[#0b0b0b] dark:text-white">
                {factor.name}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#52514e] dark:text-[#c3c2b7]">
                {factor.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
