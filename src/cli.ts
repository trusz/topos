import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { analyze } from "./analyze.js";
import { renderHtml } from "./render/build.js";
import { renderTree } from "./tree.js";
import { computeDegrees, instability } from "./metrics.js";
import { DEFAULT_KINDS } from "./resolver/resolve.js";
import type { GraphModel, SpecifierKind } from "./types.js";

const ALL_KINDS: SpecifierKind[] = [
  "static",
  "reexport",
  "sideeffect",
  "dynamic",
  "require",
  "type",
];

const program = new Command();

program
  .name("import-explorer")
  .description("Visualize cross-file import graphs for TS/React/Vue/Svelte projects.")
  .addHelpText(
    "after",
    `
Examples:
  # Interactive HTML graph of ./src
  $ import-explorer ./src -o graph.html

  # Exclude tests and config files
  $ import-explorer ./src -e '**/*.test.ts' -e '**/*.config.*'

  # Ignore type-only imports
  $ import-explorer ./src --kinds static,reexport,sideeffect

  # ASCII tree with in/out/instability metrics, two levels deep
  $ import-explorer ./src --tree --depth 2

  # Metrics for specific files/folders (machine-readable)
  $ import-explorer ./src -m src/store -m src/api/client.ts --json
`,
  )
  .argument("<root>", "root directory to scan")
  .option("-o, --out <file>", "output HTML file", "import-graph.html")
  .option("--tsconfig <file>", "path to tsconfig.json (defaults to nearest)")
  .option("--no-gitignore", "do not honor .gitignore")
  .option(
    "-e, --exclude <glob>",
    "glob to exclude (repeatable, or comma-separated), e.g. '**/*.test.ts'",
    collectList,
    [] as string[],
  )
  .option(
    "--kinds <list>",
    `comma-separated import kinds to include (${ALL_KINDS.join(",")})`,
    DEFAULT_KINDS.join(","),
  )
  .option("--json", "machine-readable JSON output (with --metrics), or write the graph model next to the HTML")
  .option("--tree", "print an ASCII tree with in/out/instability metrics to stdout (no HTML)")
  .option("--depth <n>", "max tree depth to print with --tree (default: unlimited)", parsePositiveInt)
  .option(
    "-m, --metrics <path>",
    "compute in/out/instability for a file or folder (repeatable, comma-separated); prints to stdout, no HTML",
    collectList,
    [] as string[],
  )
  .action((root: string, opts) => {
    const kinds = parseKinds(opts.kinds);
    const result = analyze(root, {
      gitignore: opts.gitignore,
      tsconfig: opts.tsconfig,
      kinds,
      exclude: opts.exclude,
    });

    if (opts.metrics.length > 0) {
      runMetrics(result.graph, opts.metrics, opts.json);
      reportWarnings(result);
      return;
    }

    if (opts.tree) {
      console.log(renderTree(result.graph, { maxDepth: opts.depth }));
      reportWarnings(result);
      return;
    }

    const outPath = resolve(opts.out);
    writeFileSync(outPath, renderHtml(result.graph), "utf8");

    if (opts.json) {
      const jsonPath = outPath.replace(/\.html?$/i, "") + ".json";
      writeFileSync(jsonPath, JSON.stringify(result.graph, null, 2), "utf8");
      console.error(`Wrote graph model: ${jsonPath}`);
    }

    reportWarnings(result);
    console.error(
      `Scanned ${result.fileCount} files → ${result.graph.edges.length} import edges. Wrote ${outPath}`,
    );
  });

program.parse();

/** Parse a positive integer CLI option, exiting on invalid input. */
function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`Invalid --depth "${value}": expected a positive integer.`);
    process.exit(1);
  }
  return n;
}

/** Accumulate a repeated, optionally comma-separated string option into an array. */
function collectList(value: string, previous: string[]): string[] {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...previous, ...items];
}

/** Compute and print in/out/instability for specific files/folders. */
function runMetrics(graph: GraphModel, paths: string[], asJson: boolean): void {
  const { inCount, outCount } = computeDegrees(graph.nodes, graph.edges);
  const byId = new Set(graph.nodes.map((n) => n.id));

  const rows = paths.map((p) => {
    const id = resolveToNodeId(p, graph.root, byId);
    if (id === null) {
      return { path: p, id: null, found: false, incoming: null, outgoing: null, instability: null };
    }
    const inC = inCount.get(id) ?? 0;
    const outC = outCount.get(id) ?? 0;
    return { path: p, id, found: true, incoming: inC, outgoing: outC, instability: instability(inC, outC) };
  });

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const r of rows) {
    if (!r.found) {
      console.error(`not found in graph: ${r.path}`);
      continue;
    }
    const iStr = r.instability === null ? "–" : r.instability.toFixed(4).replace(".", ",");
    console.log(`${r.id}\t↓ ${r.incoming} ↑ ${r.outgoing} I ${iStr}`);
  }
}

/**
 * Map a user-supplied path to a graph node id (root-relative posix). Accepts paths
 * relative to the cwd or already relative to the scan root; tolerates a trailing slash.
 */
function resolveToNodeId(arg: string, root: string, ids: Set<string>): string | null {
  const stripped = arg.replace(/[/\\]+$/, "");
  const fromCwd = toPosix(relative(root, resolve(process.cwd(), stripped)));
  const asGiven = toPosix(stripped).replace(/^\.\//, "");
  for (const candidate of [fromCwd, asGiven]) {
    if (candidate && !candidate.startsWith("..") && ids.has(candidate)) return candidate;
  }
  return null;
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function parseKinds(raw: string): SpecifierKind[] {
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid: SpecifierKind[] = [];
  for (const k of requested) {
    if ((ALL_KINDS as string[]).includes(k)) valid.push(k as SpecifierKind);
    else console.error(`Ignoring unknown import kind: "${k}"`);
  }
  return valid.length ? valid : DEFAULT_KINDS;
}

function reportWarnings(result: ReturnType<typeof analyze>): void {
  for (const w of result.warnings) {
    console.error(`warn: ${w.file ? w.file + ": " : ""}${w.message}`);
  }
  if (result.unresolvedCount > 0) {
    console.error(
      `warn: ${result.unresolvedCount} in-project import(s) could not be resolved to a scanned file (dropped).`,
    );
  }
}
