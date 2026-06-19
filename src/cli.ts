import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyze } from "./analyze.js";
import { renderHtml } from "./render/build.js";
import { DEFAULT_KINDS } from "./resolver/resolve.js";
import type { SpecifierKind } from "./types.js";

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
  .argument("<root>", "root directory to scan")
  .option("-o, --out <file>", "output HTML file", "import-graph.html")
  .option("--tsconfig <file>", "path to tsconfig.json (defaults to nearest)")
  .option("--no-gitignore", "do not honor .gitignore")
  .option(
    "-e, --exclude <glob>",
    "glob to exclude (repeatable, or comma-separated), e.g. '**/*.test.ts'",
    collectExcludes,
    [] as string[],
  )
  .option(
    "--kinds <list>",
    `comma-separated import kinds to include (${ALL_KINDS.join(",")})`,
    DEFAULT_KINDS.join(","),
  )
  .option("--json", "also write the graph model JSON next to the HTML")
  .action((root: string, opts) => {
    const kinds = parseKinds(opts.kinds);
    const result = analyze(root, {
      gitignore: opts.gitignore,
      tsconfig: opts.tsconfig,
      kinds,
      exclude: opts.exclude,
    });

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

/** Accumulate repeated --exclude flags, each of which may be comma-separated. */
function collectExcludes(value: string, previous: string[]): string[] {
  const globs = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...previous, ...globs];
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
