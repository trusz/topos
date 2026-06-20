import type { GraphNode, GraphEdge } from "./types.js";

export interface Degrees {
  /** node id -> import edges entering its subtree from outside. */
  inCount: Map<string, number>;
  /** node id -> import edges leaving its subtree to outside. */
  outCount: Map<string, number>;
}

/**
 * Per-node incoming/outgoing import counts for the given edge set. For a file these
 * are its own in/out edges; for a folder they are the import edges that cross its
 * subtree boundary (in = imported from outside, out = importing the outside). Edges
 * internal to a subtree count for neither side of that folder.
 */
export function computeDegrees(nodes: GraphNode[], edges: GraphEdge[]): Degrees {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();

  const ancestorsOf = (id: string): Set<string> => {
    const set = new Set<string>();
    let cur = nodeById.get(id);
    while (cur) {
      set.add(cur.id);
      cur = cur.parent ? nodeById.get(cur.parent) : undefined;
    }
    return set;
  };

  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);

  for (const e of edges) {
    const au = ancestorsOf(e.source);
    const av = ancestorsOf(e.target);
    // X has an outgoing crossing edge if it contains the source but not the target,
    // incoming if it contains the target but not the source. Shared ancestors (the
    // common enclosing folder) are excluded, so internal edges cross no boundary.
    for (const x of au) if (!av.has(x)) bump(outCount, x);
    for (const x of av) if (!au.has(x)) bump(inCount, x);
  }
  return { inCount, outCount };
}

/** Instability (Martin) = out / (in + out): 0 = stable, 1 = unstable. null if no edges. */
export function instability(inC: number, outC: number): number | null {
  const total = inC + outC;
  return total > 0 ? outC / total : null;
}
