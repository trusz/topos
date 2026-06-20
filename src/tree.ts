import type { GraphModel, GraphNode } from "./types.js";
import { computeDegrees, instability } from "./metrics.js";

export interface TreeOptions {
  /** Decimal separator for the instability value. Default ",". */
  decimalSeparator?: "," | ".";
  /** Maximum tree depth to print (top-level = depth 1). Default: unlimited. */
  maxDepth?: number;
}

/**
 * Render the project as an ASCII tree. Every file and folder is annotated with its
 * boundary-crossing import counts and instability (the same aggregate the HTML view
 * shows): for a folder, edges that leave/enter its subtree bounds.
 *
 *   .
 *   └── behavior-description/ ↓ 10 ↑ 3 I 0,2308
 *       └── dialecte-extension/ ↓ 4 ↑ 1 I 0,2000
 *           └── query.ts ↓ 2 ↑ 0 I 0,0000
 */
export function renderTree(model: GraphModel, options: TreeOptions = {}): string {
  const sep = options.decimalSeparator ?? ",";
  const maxDepth = options.maxDepth ?? Infinity;
  const { inCount, outCount } = computeDegrees(model.nodes, model.edges);

  // Group children by parent id (null = top level).
  const childrenOf = new Map<string | null, GraphNode[]>();
  for (const n of model.nodes) {
    const key = n.parent ?? null;
    (childrenOf.get(key) ?? childrenOf.set(key, []).get(key)!).push(n);
  }
  for (const list of childrenOf.values()) list.sort(compareNodes);

  const annotate = (n: GraphNode): string => {
    const inC = inCount.get(n.id) ?? 0;
    const outC = outCount.get(n.id) ?? 0;
    const i = instability(inC, outC);
    const iStr = i === null ? "–" : i.toFixed(4).replace(".", sep);
    const name = n.type === "folder" ? `${n.label}/` : n.label;
    return `${name} ↓ ${inC} ↑ ${outC} I ${iStr}`;
  };

  // Metrics are always computed over the full model; maxDepth only limits printing.
  const lines: string[] = ["."];
  const walk = (parentId: string | null, prefix: string, depth: number): void => {
    const children = childrenOf.get(parentId) ?? [];
    children.forEach((child, idx) => {
      const last = idx === children.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${annotate(child)}`);
      if (child.type === "folder" && depth < maxDepth) {
        walk(child.id, prefix + (last ? "    " : "│   "), depth + 1);
      }
    });
  };
  walk(null, "", 1);

  return lines.join("\n");
}

/** Folders before files, then alphabetical (locale-independent). */
function compareNodes(a: GraphNode, b: GraphNode): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}
