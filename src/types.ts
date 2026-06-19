// Shared types for the analysis pipeline and the stable JSON graph contract.

/** How an import-like construct was written in source. */
export type SpecifierKind =
  | "static" // import x from './y'
  | "reexport" // export { x } from './y'
  | "sideeffect" // import './y'
  | "dynamic" // import('./y')
  | "require" // require('./y')
  | "type"; // import type { T } from './y'

/** A raw module specifier as extracted from a source file, before resolution. */
export interface RawSpecifier {
  /** The literal string, e.g. './module2' or '@/module2'. */
  specifier: string;
  kind: SpecifierKind;
}

/** Result of extracting specifiers from one file. */
export interface ExtractedFile {
  /** Absolute path of the file the imports were found in. */
  file: string;
  specifiers: RawSpecifier[];
}

/** A resolved, deduped import relationship between two scanned files. */
export interface ImportEdge {
  /** Absolute path of the importing file. */
  from: string;
  /** Absolute path of the imported file. */
  to: string;
  /** Number of distinct import statements collapsed into this edge. */
  weight: number;
  /** Distinct specifier kinds that contributed to this edge. */
  kinds: SpecifierKind[];
}

// --- The stable JSON graph contract consumed by the viewer ---

export interface GraphNode {
  /** Stable id: path relative to the scan root (posix-style). */
  id: string;
  /** Display label: basename. */
  label: string;
  /** Containing folder id, or null for the root. */
  parent: string | null;
  type: "file" | "folder";
}

export interface GraphEdge {
  /** id of the source file node. */
  source: string;
  /** id of the target file node. */
  target: string;
  weight: number;
  kinds: SpecifierKind[];
}

export interface GraphModel {
  /** Absolute path that was scanned, for display. */
  root: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Non-fatal issues surfaced to the user on stderr. */
export interface AnalysisWarning {
  file?: string;
  message: string;
}
