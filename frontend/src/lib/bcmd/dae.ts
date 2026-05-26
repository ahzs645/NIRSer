export interface NewtonSolveOptions {
  tolerance?: number;
  maxIterations?: number;
  step?: number;
}

export interface NewtonSolveResult {
  values: Record<string, number>;
  residuals: number[];
  iterations: number;
  converged: boolean;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col] || 1e-12;
    for (let item = col; item <= n; item += 1) a[col][item] /= scale;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let item = col; item <= n; item += 1) a[row][item] -= factor * a[col][item];
    }
  }
  return a.map((row) => row[n]);
}

export function solveNewtonSystem(
  names: readonly string[],
  initial: Record<string, number>,
  residual: (values: Record<string, number>) => number[],
  options: NewtonSolveOptions = {},
): NewtonSolveResult {
  const tolerance = options.tolerance ?? 1e-8;
  const maxIterations = options.maxIterations ?? 30;
  const h = options.step ?? 1e-5;
  let values = { ...initial };
  let residuals = residual(values);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const error = Math.max(...residuals.map(Math.abs), 0);
    if (error < tolerance) return { values, residuals, iterations: iteration, converged: true };
    const jacobian = residuals.map((_, row) =>
      names.map((name) => {
        const perturbed = { ...values, [name]: values[name] + h };
        return (residual(perturbed)[row] - residuals[row]) / h;
      }),
    );
    const delta = solveLinearSystem(jacobian, residuals.map((item) => -item));
    values = Object.fromEntries(names.map((name, index) => [name, values[name] + delta[index]]));
    residuals = residual(values);
  }

  return { values, residuals, iterations: maxIterations, converged: false };
}

export function implicitEulerStep(
  state: Record<string, number>,
  t: number,
  step: number,
  derivative: (nextState: Record<string, number>, nextTime: number) => Record<string, number>,
  options: NewtonSolveOptions = {},
) {
  const names = Object.keys(state);
  return solveNewtonSystem(
    names,
    state,
    (next) => {
      const slopes = derivative(next, t + step);
      return names.map((name) => next[name] - state[name] - step * (slopes[name] ?? 0));
    },
    options,
  );
}

export function radauLikeImplicitStep(
  state: Record<string, number>,
  t: number,
  step: number,
  derivative: (nextState: Record<string, number>, nextTime: number) => Record<string, number>,
  options: NewtonSolveOptions = {},
) {
  const first = implicitEulerStep(state, t, step / 2, derivative, options).values;
  return implicitEulerStep(first, t + step / 2, step / 2, derivative, options);
}
