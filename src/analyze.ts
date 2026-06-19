import { resolve as resolvePath } from "node:path";
import { discover } from "./discover.js";
import { resolveConfig } from "./resolver/config.js";
import { Extractor } from "./extract.js";
import { resolveEdges, DEFAULT_KINDS } from "./resolver/resolve.js";
import { buildGraph } from "./graph.js";
import type { GraphModel, SpecifierKind, AnalysisWarning } from "./types.js";

export interface AnalyzeOptions {
  gitignore?: boolean;
  tsconfig?: string;
  kinds?: SpecifierKind[];
  /** Extra glob patterns (relative to root) to exclude from scanning. */
  exclude?: string[];
}

export interface AnalyzeResult {
  graph: GraphModel;
  warnings: AnalysisWarning[];
  unresolvedCount: number;
  fileCount: number;
}

/** Run the full analysis pipeline against a root directory. */
export function analyze(root: string, options: AnalyzeOptions = {}): AnalyzeResult {
  const absRoot = resolvePath(root);
  const warnings: AnalysisWarning[] = [];

  const files = discover(absRoot, { gitignore: options.gitignore, exclude: options.exclude });

  const config = resolveConfig(absRoot, options.tsconfig);
  warnings.push(...config.warnings);

  const extractor = new Extractor();
  const extracted = files.map((f) => extractor.extract(f));
  warnings.push(...extractor.warnings);

  const { edges, warnings: resolveWarnings, unresolvedCount } = resolveEdges(
    extracted,
    config,
    files,
    options.kinds ?? DEFAULT_KINDS,
  );
  warnings.push(...resolveWarnings);

  const graph = buildGraph(absRoot, files, edges);
  return { graph, warnings, unresolvedCount, fileCount: files.length };
}
