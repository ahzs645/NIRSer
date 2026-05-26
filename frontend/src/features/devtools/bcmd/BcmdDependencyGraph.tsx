import { useMemo } from "react";
import * as d3 from "d3";
import type { BcmdGraphEdge, BcmdGraphNode } from "../../../lib/bcmd/index";

type LayoutNode = BcmdGraphNode & d3.SimulationNodeDatum;
type LayoutEdge = Omit<BcmdGraphEdge, "source" | "target"> & d3.SimulationLinkDatum<LayoutNode>;

const colors: Record<string, string> = {
  input: "#0f766e",
  output: "#2563eb",
  root: "#7c3aed",
  parameter: "#b45309",
  intermediate: "#be123c",
  reaction: "#334155",
  species: "#0891b2",
  equation: "#475569",
  unknown: "#64748b",
};

export function BcmdDependencyGraph({ nodes, edges }: { nodes: BcmdGraphNode[]; edges: BcmdGraphEdge[] }) {
  const layout = useMemo(() => {
    const width = 720;
    const height = 320;
    const simNodes: LayoutNode[] = nodes.map((node) => ({ ...node }));
    const simEdges: LayoutEdge[] = edges.map((edge) => ({ ...edge }));
    d3.forceSimulation(simNodes)
      .force("link", d3.forceLink<LayoutNode, LayoutEdge>(simEdges).id((node) => node.id).distance(86).strength(0.7))
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(34))
      .stop()
      .tick(180);
    return { width, height, nodes: simNodes, edges: simEdges };
  }, [nodes, edges]);

  return (
    <svg className="h-80 w-full rounded-md border border-slate-200 bg-white" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img">
      <defs>
        <marker id="bcmd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>
      <g>
        {layout.edges.map((edge, index) => {
          const source = edge.source as LayoutNode;
          const target = edge.target as LayoutNode;
          return (
            <line
              key={`${source.id}-${target.id}-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="#94a3b8"
              strokeWidth={1.4}
              markerEnd="url(#bcmd-arrow)"
            />
          );
        })}
      </g>
      <g>
        {layout.nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}>
            <circle r={17} fill={colors[node.kind] ?? colors.unknown} />
            <text y={31} textAnchor="middle" fontSize="10" fill="#334155">
              {node.label.split("\n")[0]}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
