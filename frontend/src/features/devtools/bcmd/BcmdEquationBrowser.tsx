import type { BcmdEquationFilter, BcmdProcessedModel } from "../../../lib/bcmd/index";
import { bcmdEquationLabel, filterBcmdEquations } from "../../../lib/bcmd/index";

export function BcmdEquationBrowser({
  model,
  filter,
  onFilterChange,
}: {
  model: BcmdProcessedModel;
  filter: BcmdEquationFilter;
  onFilterChange: (filter: BcmdEquationFilter) => void;
}) {
  const equations = filterBcmdEquations(model, filter);
  const filters: BcmdEquationFilter[] = ["all", "roots", "parameters", "inputs", "outputs", "unknown", "constraints", "reactions"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${filter === item ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            onClick={() => onFilterChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
        {equations.map((node) => (
          <div key={`${node.kind}-${node.startLine}-${node.source}`} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
            <div className="text-xs text-slate-500">line {node.startLine} · {node.kind}</div>
            <code className="block whitespace-pre-wrap text-xs text-slate-900">{bcmdEquationLabel(node)}</code>
          </div>
        ))}
        {equations.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-500">No matching equations</div>}
      </div>
    </div>
  );
}
