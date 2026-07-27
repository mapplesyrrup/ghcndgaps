// Dense LU decomposition with partial pivoting, combined L/U storage (Doolittle).
// Used to solve the ordinary-kriging system once per active-station configuration, then
// reused (via forward/back substitution) for every candidate grid cell's right-hand side.

export interface LUDecomposition {
  lu: number[][];
  perm: number[];
  n: number;
}

export function luDecompose(matrix: number[][]): LUDecomposition {
  const n = matrix.length;
  const lu = matrix.map((row) => row.slice());
  const perm = Array.from({ length: n }, (_, i) => i);

  for (let k = 0; k < n; k++) {
    let pivotRow = k;
    let pivotVal = Math.abs(lu[k][k]);
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(lu[i][k]) > pivotVal) {
        pivotVal = Math.abs(lu[i][k]);
        pivotRow = i;
      }
    }
    if (pivotRow !== k) {
      [lu[k], lu[pivotRow]] = [lu[pivotRow], lu[k]];
      [perm[k], perm[pivotRow]] = [perm[pivotRow], perm[k]];
    }

    const pivot = lu[k][k];
    if (Math.abs(pivot) < 1e-12) continue; // near-singular; leave zeroed row, solve() degrades gracefully

    for (let i = k + 1; i < n; i++) {
      const factor = lu[i][k] / pivot;
      lu[i][k] = factor;
      for (let j = k + 1; j < n; j++) {
        lu[i][j] -= factor * lu[k][j];
      }
    }
  }

  return { lu, perm, n };
}

export function luSolve({ lu, perm, n }: LUDecomposition, b: number[]): number[] {
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[perm[i]];
    for (let j = 0; j < i; j++) sum -= lu[i][j] * y[j];
    y[i] = sum;
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let j = i + 1; j < n; j++) sum -= lu[i][j] * x[j];
    x[i] = lu[i][i] !== 0 ? sum / lu[i][i] : 0;
  }

  return x;
}
