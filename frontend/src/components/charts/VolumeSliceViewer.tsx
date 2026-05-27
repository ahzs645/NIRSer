import { useMemo, useState } from "react";
import { sliceVolume, type NiftiImage } from "../../lib/nifti";

type Axis = "x" | "y" | "z";

function axisLimit(image: NiftiImage, axis: Axis) {
  return axis === "x" ? image.dims[0] - 1 : axis === "y" ? image.dims[1] - 1 : image.dims[2] - 1;
}

function colorScale(values: number[]) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const low = finite[Math.floor(finite.length * 0.02)] ?? 0;
  const high = finite[Math.floor(finite.length * 0.98)] ?? 1;
  const span = high === low ? 1 : high - low;
  return (value: number) => {
    const scaled = Math.max(0, Math.min(255, Math.round(((value - low) / span) * 255)));
    return `rgb(${scaled},${scaled},${scaled})`;
  };
}

export function VolumeSliceViewer({ image, title = "MRI slice", color = "gray" }: { image: NiftiImage; title?: string; color?: "gray" | "heat" }) {
  const [axis, setAxis] = useState<Axis>("z");
  const [slice, setSlice] = useState(() => Math.floor(image.dims[2] / 2));
  const maxSlice = axisLimit(image, axis);
  const clampedSlice = Math.max(0, Math.min(slice, maxSlice));
  const view = useMemo(() => sliceVolume(image.values, image.dims, axis, clampedSlice), [axis, clampedSlice, image]);
  const fill = useMemo(() => {
    const base = colorScale(view.values);
    if (color === "gray") return base;
    const finite = view.values.filter(Number.isFinite);
    const low = Math.min(...finite);
    const high = Math.max(...finite);
    const span = high === low ? 1 : high - low;
    return (value: number) => {
      const t = Math.max(0, Math.min(1, (value - low) / span));
      return `rgb(${Math.round(255 * t)},${Math.round(160 * t)},${Math.round(255 * (1 - t))})`;
    };
  }, [color, view.values]);
  const cell = Math.max(1, Math.min(5, Math.floor(420 / Math.max(view.width, view.height))));
  const width = view.width * cell;
  const height = view.height * cell;

  function changeAxis(value: Axis) {
    setAxis(value);
    setSlice(Math.floor(axisLimit(image, value) / 2));
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {image.dims.join(" x ")} voxels, datatype {image.datatype}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 overflow-hidden rounded-md border border-slate-200">
            {(["x", "y", "z"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`px-3 text-sm font-medium ${axis === item ? "bg-teal-700 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => changeAxis(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Slice
            <input
              type="range"
              min={0}
              max={maxSlice}
              value={clampedSlice}
              onChange={(event) => setSlice(Number(event.target.value))}
            />
            <span className="w-12 text-right font-mono">{clampedSlice}</span>
          </label>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} ${axis} slice`}>
          {view.values.map((value, index) => {
            const x = (index % view.width) * cell;
            const y = Math.floor(index / view.width) * cell;
            return <rect key={`${x}-${y}`} x={x} y={height - y - cell} width={cell} height={cell} fill={fill(value)} />;
          })}
        </svg>
      </div>
    </section>
  );
}
