// Sequential blue ramp (magnitude encoding) from the dataviz skill's reference palette.
// Stops run light -> dark as missing% goes 0 -> 100.
const STOPS: Array<[number, [number, number, number]]> = [
  [0, [205, 226, 251]], // #cde2fb (step 100)
  [12.5, [158, 197, 244]], // #9ec5f4 (step 200)
  [25, [109, 167, 236]], // #6da7ec (step 300)
  [37.5, [57, 135, 229]], // #3987e5 (step 400)
  [50, [42, 120, 214]], // #2a78d6 (step 450)
  [62.5, [37, 106, 191]], // #256abf (step 500)
  [75, [28, 92, 171]], // #1c5cab (step 550)
  [87.5, [24, 79, 149]], // #184f95 (step 600)
  [100, [13, 54, 107]], // #0d366b (step 700)
];

export function missingPctToColor(pct: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(100, pct));
  for (let i = 1; i < STOPS.length; i++) {
    const [pLo, cLo] = STOPS[i - 1];
    const [pHi, cHi] = STOPS[i];
    if (clamped <= pHi) {
      const t = (clamped - pLo) / (pHi - pLo);
      return [
        Math.round(cLo[0] + (cHi[0] - cLo[0]) * t),
        Math.round(cLo[1] + (cHi[1] - cLo[1]) * t),
        Math.round(cLo[2] + (cHi[2] - cLo[2]) * t),
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// Same ramp, but keyed by a 0-1 ratio instead of a 0-100 percentage — for magnitudes like
// kriging variance that don't have a natural percent scale.
export function ratioToColor(ratio: number): [number, number, number] {
  return missingPctToColor(ratio * 100);
}
