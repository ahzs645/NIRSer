export type OdeState = Record<string, number>;
export type OdeParameters = Record<string, number>;

export interface OdeContext<TState extends OdeState = OdeState, TParameters extends OdeParameters = OdeParameters> {
  t: number;
  state: Readonly<TState>;
  parameters: Readonly<TParameters>;
}

export type OdeDerivative<TState extends OdeState = OdeState, TParameters extends OdeParameters = OdeParameters> = (
  context: OdeContext<TState, TParameters>,
) => Partial<TState>;

export type OdeOutput<TState extends OdeState = OdeState, TParameters extends OdeParameters = OdeParameters> = (
  context: OdeContext<TState, TParameters>,
) => Record<string, number>;

export interface SimulationOptions<TState extends OdeState = OdeState, TParameters extends OdeParameters = OdeParameters> {
  initialState: TState;
  parameters?: TParameters;
  derivative: OdeDerivative<TState, TParameters>;
  start: number;
  end: number;
  step: number;
  method?: "euler" | "rk4";
  output?: OdeOutput<TState, TParameters>;
  project?: (context: OdeContext<TState, TParameters>) => TState;
}

export interface SimulationPoint<TState extends OdeState = OdeState> {
  t: number;
  state: TState;
  output: Record<string, number>;
}

function addScaled<TState extends OdeState>(state: TState, derivative: Partial<TState>, scale: number): TState {
  const next: OdeState = { ...state };
  for (const key of Object.keys(state) as Array<keyof TState>) {
    next[key as string] = state[key] + (derivative[key] ?? 0) * scale;
  }
  return next as TState;
}

function combineRk4<TState extends OdeState>(
  state: TState,
  k1: Partial<TState>,
  k2: Partial<TState>,
  k3: Partial<TState>,
  k4: Partial<TState>,
  step: number,
): TState {
  const next: OdeState = { ...state };
  for (const key of Object.keys(state) as Array<keyof TState>) {
    const slope = ((k1[key] ?? 0) + 2 * (k2[key] ?? 0) + 2 * (k3[key] ?? 0) + (k4[key] ?? 0)) / 6;
    next[key as string] = state[key] + slope * step;
  }
  return next as TState;
}

function point<TState extends OdeState, TParameters extends OdeParameters>(
  t: number,
  state: TState,
  parameters: TParameters,
  output?: OdeOutput<TState, TParameters>,
): SimulationPoint<TState> {
  return {
    t,
    state: { ...state },
    output: output?.({ t, state, parameters }) ?? {},
  };
}

export function simulateOde<TState extends OdeState, TParameters extends OdeParameters = OdeParameters>(
  options: SimulationOptions<TState, TParameters>,
) {
  if (options.step <= 0) throw new Error("Simulation step must be positive");
  if (options.end < options.start) throw new Error("Simulation end must be greater than or equal to start");

  const method = options.method ?? "rk4";
  const parameters = (options.parameters ?? {}) as TParameters;
  const points: Array<SimulationPoint<TState>> = [];
  let t = options.start;
  let state = { ...options.initialState };
  points.push(point(t, state, parameters, options.output));

  while (t < options.end - Number.EPSILON) {
    const step = Math.min(options.step, options.end - t);
    if (method === "euler") {
      state = addScaled(state, options.derivative({ t, state, parameters }), step);
    } else {
      const k1 = options.derivative({ t, state, parameters });
      const k2 = options.derivative({ t: t + step / 2, state: addScaled(state, k1, step / 2), parameters });
      const k3 = options.derivative({ t: t + step / 2, state: addScaled(state, k2, step / 2), parameters });
      const k4 = options.derivative({ t: t + step, state: addScaled(state, k3, step), parameters });
      state = combineRk4(state, k1, k2, k3, k4, step);
    }
    t += step;
    if (options.project) state = options.project({ t, state, parameters });
    points.push(point(t, state, parameters, options.output));
  }

  return points;
}

export interface AdaptiveOdeOptions<TState extends OdeState = OdeState, TParameters extends OdeParameters = OdeParameters>
  extends Omit<SimulationOptions<TState, TParameters>, "step" | "method"> {
  initialStep: number;
  minStep?: number;
  maxStep?: number;
  tolerance?: number;
}

function maxStateError<TState extends OdeState>(left: TState, right: TState) {
  return Math.max(...Object.keys(left).map((key) => Math.abs(left[key] - right[key])), 0);
}

export function simulateAdaptiveOde<TState extends OdeState, TParameters extends OdeParameters = OdeParameters>(
  options: AdaptiveOdeOptions<TState, TParameters>,
) {
  const tolerance = options.tolerance ?? 1e-5;
  const minStep = options.minStep ?? options.initialStep / 128;
  const maxStep = options.maxStep ?? options.initialStep * 8;
  const parameters = (options.parameters ?? {}) as TParameters;
  const points: Array<SimulationPoint<TState>> = [];
  let t = options.start;
  let step = options.initialStep;
  let state = { ...options.initialState };
  points.push(point(t, state, parameters, options.output));

  while (t < options.end - Number.EPSILON) {
    const trialStep = Math.min(step, options.end - t);
    const coarse = simulateOde({ ...options, parameters, start: t, end: t + trialStep, step: trialStep, initialState: state, method: "rk4" }).at(-1)?.state ?? state;
    const fine = simulateOde({ ...options, parameters, start: t, end: t + trialStep, step: trialStep / 2, initialState: state, method: "rk4" }).at(-1)?.state ?? state;
    const error = maxStateError(coarse, fine);
    if (error <= tolerance || trialStep <= minStep) {
      t += trialStep;
      state = options.project?.({ t, state: fine, parameters }) ?? fine;
      points.push(point(t, state, parameters, options.output));
      if (error < tolerance / 8) step = Math.min(maxStep, trialStep * 2);
    } else {
      step = Math.max(minStep, trialStep / 2);
    }
  }

  return points;
}
