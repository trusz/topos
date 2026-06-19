import { relative, sep, basename } from "node:path";
import type { GraphModel, GraphNode, GraphEdge, ImportEdge } from "./types.js";

/**
 * Build the stable JSON graph model: a file node for every scanned file, a folder
 * node for every ancestor directory (compound-node parents), and file->file edges.
 * Node ids are root-relative posix paths.
 */
export function buildGraph(root: string, files: string[], edges: ImportEdge[]): GraphModel {
  const nodes = new Map<string, GraphNode>();

  for (const abs of files) {
    const rel = toPosix(relative(root, abs));
    const segments = rel.split("/");
    // Ensure a folder node for every ancestor directory.
    let parentId: string | null = null;
    for (let i = 0; i < segments.length - 1; i++) {
      const folderId = segments.slice(0, i + 1).join("/");
      if (!nodes.has(folderId)) {
        nodes.set(folderId, {
          id: folderId,
          label: segments[i],
          parent: parentId,
          type: "folder",
        });
      }
      parentId = folderId;
    }
    nodes.set(rel, {
      id: rel,
      label: basename(rel),
      parent: parentId,
      type: "file",
    });
  }

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    source: toPosix(relative(root, e.from)),
    target: toPosix(relative(root, e.to)),
    weight: e.weight,
    kinds: e.kinds,
  }));

  return { root, nodes: [...nodes.values()], edges: graphEdges };
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}
