import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { sliceVolume, type NiftiImage } from "../../lib/nifti";

type Axis = "x" | "y" | "z";

function axisLimit(image: NiftiImage, axis: Axis) {
  return axis === "x" ? image.dims[0] - 1 : axis === "y" ? image.dims[1] - 1 : image.dims[2] - 1;
}

function colorScale(values: number[], color: "gray" | "heat") {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const low = finite[Math.floor(finite.length * 0.02)] ?? 0;
  const high = finite[Math.floor(finite.length * 0.98)] ?? 1;
  if (color === "heat") return d3.scaleSequential(d3.interpolateMagma).domain([low, high]).clamp(true);
  return d3.scaleSequential(d3.interpolateGreys).domain([low, high]).clamp(true);
}

export function VolumeSliceViewer({ image, title = "MRI slice", color = "gray" }: { image: NiftiImage; title?: string; color?: "gray" | "heat" }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [axis, setAxis] = useState<Axis>("z");
  const [slice, setSlice] = useState(() => Math.floor(image.dims[2] / 2));
  const maxSlice = axisLimit(image, axis);
  const clampedSlice = Math.max(0, Math.min(slice, maxSlice));
  const view = useMemo(() => sliceVolume(image.values, image.dims, axis, clampedSlice), [axis, clampedSlice, image]);
  const cell = Math.max(1, Math.min(5, Math.floor(420 / Math.max(view.width, view.height))));
  const width = view.width * cell;
  const height = view.height * cell;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const fill = colorScale(view.values, color);
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg
      .append("g")
      .selectAll("rect")
      .data(view.values)
      .join("rect")
      .attr("x", (_, index) => (index % view.width) * cell)
      .attr("y", (_, index) => height - Math.floor(index / view.width) * cell - cell)
      .attr("width", cell)
      .attr("height", cell)
      .attr("fill", (value) => (Number.isFinite(value) ? fill(value) : "#020617"));
  }, [cell, color, height, view]);

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
        <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} ${axis} slice`} />
      </div>
    </section>
  );
}
