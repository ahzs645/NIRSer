export function transpose(matrix: number[][]) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, col) => Array.from({ length: rows }, (_, row) => matrix[row][col] ?? 0));
}

export function multiplyMatrices(left: number[][], right: number[][]) {
  const rows = left.length;
  const inner = left[0]?.length ?? 0;
  const cols = right[0]?.length ?? 0;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      let sum = 0;
      for (let index = 0; index < inner; index += 1) sum += (left[row][index] ?? 0) * (right[index]?.[col] ?? 0);
      return sum;
    }),
  );
}

export function multiplyMatrixVector(matrix: number[][], vector: number[]) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

export function addRidge(matrix: number[][], lambda: number) {
  return matrix.map((row, rowIndex) => row.map((value, colIndex) => value + (rowIndex === colIndex ? lambda : 0)));
}

export function invertMatrix(matrix: number[][]) {
  const n = matrix.length;
  if (n === 0 || matrix.some((row) => row.length !== n)) throw new Error("Matrix must be square.");
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: n }, (_, colIndex) => (rowIndex === colIndex ? 1 : 0)),
  ]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    }
    if (Math.abs(augmented[best][pivot]) < 1e-12) throw new Error("Matrix is singular.");
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    augmented[pivot] = augmented[pivot].map((value) => value / divisor);
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      augmented[row] = augmented[row].map((value, col) => value - factor * augmented[pivot][col]);
    }
  }

  return augmented.map((row) => row.slice(n));
}

export function computeTikhonovInverseOperator(jacobian: number[][], lambda: number) {
  const jt = transpose(jacobian);
  const gram = multiplyMatrices(jacobian, jt);
  return multiplyMatrices(jt, invertMatrix(addRidge(gram, lambda)));
}

export function applyInverseOperator(operator: number[][], channelFrames: number[][]) {
  return multiplyMatrices(operator, channelFrames);
}

export function sensitivityDb(jacobian: number[][]) {
  const rows = jacobian.length;
  const cols = jacobian[0]?.length ?? 0;
  const power = Array.from({ length: cols }, (_, col) => {
    let sum = 0;
    for (let row = 0; row < rows; row += 1) sum += (jacobian[row][col] ?? 0) ** 2;
    return rows > 0 ? sum / rows : 0;
  });
  const db = power.map((value) => 10 * Math.log10(Math.max(value, Number.MIN_VALUE)));
  const max = Math.max(...db);
  return db.map((value) => value - max);
}

export function filterGoodChannels(firstFrame: number[], linkEnabled: number[]) {
  return linkEnabled.map((enabled, index) => Number.isFinite(firstFrame[index]) && enabled !== 0);
}

export function selectRows<T>(rows: T[], keep: boolean[]) {
  return rows.filter((_, index) => keep[index]);
}
