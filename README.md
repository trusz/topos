# Import Explorer

A CLI that scans a TypeScript / React / Vue / Svelte project, resolves what every file
imports, and emits a **single self-contained interactive HTML graph**. Files are boxes;
folders are boxes that contain their children. Import relationships are the edges.

Click any folder to **collapse** it: its subtree folds into one node, internal imports
disappear, and the imports crossing its boundary become weighted, directional aggregated
edges (e.g. `module1 ──2──▶ module2`). Click again to expand.

Each box also shows coupling metrics:

- `↓<incoming> ↑<outgoing>` — for a folder, the import edges crossing its subtree boundary
  (independent of collapse state).
- `I <decimal>` — **instability** (Martin's metric) = `out / (in + out)`: `0` = stable
  (depended upon, depends on little), `1` = unstable (depends on much, nothing depends on it).
  Shown to two decimals, e.g. `I 0.25`; `I –` when the box has no edges.

A **type-only imports** checkbox in the toolbar shows/hides edges that are *exclusively*
`import type` (edges that also carry a runtime import stay). Toggling it updates the edges,
the counts, and the instability metric together.

### Layouts

A **Layout** dropdown in the toolbar (powered by [ELK](https://github.com/kieler/elkjs)
plus fCoSE):

- **ELK: Layered** (default) — hierarchical, edges flow top-down by dependency direction.
  Best for reading "what imports what".
- **ELK: Stress** — distances reflect coupling; good for spotting clusters.
- **ELK: Force / Radial / Tree** and **fCoSE** (organic).

An **Edges** dropdown switches edge routing — **Curved** (bezier), **Straight**, **Step**
(orthogonal), or **Smooth step** (rounded orthogonal). Purely visual; applied instantly.

Layout runs when the graph's **structure** changes — on first load, when you open/close a
folder, on Collapse all / Expand all, when you pick a layout, or via the **Re-layout**
button. **Dragging** a node never triggers a layout: it stays where you put it and nothing
else moves.

## Install / build

```bash
npm install
npm run build
```

## Usage

```bash
import-explorer <root> [options]

  -o, --out <file>      output HTML file (default: import-graph.html)
  --tsconfig <file>     path to tsconfig.json (default: nearest)
  --no-gitignore        do not honor .gitignore
  -e, --exclude <glob>  glob to exclude from scanning; repeatable or comma-separated,
                        e.g. -e '**/*.test.ts' -e '**/*.spec.ts' -e '**/*.config.*'
  --kinds <list>        import kinds to include
                        (static,reexport,sideeffect,type,dynamic,require;
                         default: static,reexport,sideeffect,type)
  --json                machine-readable JSON (with --metrics), or write the graph
                        model next to the HTML
  --tree                print an ASCII tree with in/out/instability metrics to
                        stdout (no HTML is written)
  --depth <n>           max tree depth to print with --tree (default: unlimited)
  -m, --metrics <path>  print in/out/instability for a file or folder (repeatable,
                        comma-separated); stdout, no HTML. Combine with --json.
```

### Tree output

`import-explorer ./src --tree` prints the project as an ASCII tree. Every file and folder
is annotated with `↓ <incoming> ↑ <outgoing> I <instability>`, where folder values are the
imports crossing that folder's subtree boundary:

```
.
├── module2/ ↓ 3 ↑ 2 I 0,4000
│   ├── module2.ts ↓ 3 ↑ 2 I 0,4000
│   └── side.ts ↓ 1 ↑ 0 I 0,0000
└── main.ts ↓ 0 ↑ 4 I 1,0000
```

Limit the printed depth with `--depth <n>` (folder aggregates still reflect the full
subtree, only the printing is truncated).

### Metrics for specific paths

Query individual files/folders without rendering the whole tree:

```
$ import-explorer ./src -m src/module2 -m src/main.ts
src/module2     ↓ 3 ↑ 2 I 0,4000
src/main.ts     ↓ 0 ↑ 4 I 1,0000

$ import-explorer ./src --metrics src/module2 --json
[ { "path": "src/module2", "id": "src/module2", "found": true,
    "incoming": 3, "outgoing": 2, "instability": 0.4 } ]
```

Paths may be given relative to the cwd or to the scan root. Unknown paths are reported on
stderr (and `found: false` in JSON).

Exclude globs are matched relative to `<root>`. `node_modules` is always skipped.
Type-only imports (`import type { T } from './t'`) are included by default; drop them with
`--kinds static,reexport,sideeffect`.

Open the resulting HTML file in any browser — it is fully offline.

### Try the example

```bash
npm run example        # writes example/graph.html from example/sample
```

## How it works

A small pipeline with a stable JSON graph model in the middle:

```
discover → resolve-config → extract-imports → resolve-specifiers → build-graph → render-html
```

- **discover** — walk the root, honor `.gitignore`, skip `node_modules`; scan
  `.ts .tsx .js .jsx .mjs .cjs .vue .svelte`.
- **resolve-config** — read `tsconfig.json` (`paths`/`baseUrl`) and `vite.config.*`
  (`resolve.alias`, parsed statically) into one alias map.
- **extract-imports** — per-framework unwrappers pull script text from `.vue`
  (`@vue/compiler-sfc`) and `.svelte` (`svelte/compiler`); a shared `ts-morph` pass reads
  import / re-export / side-effect specifiers.
- **resolve-specifiers** — map each specifier to a scanned file via alias / relative /
  index resolution; drop externals and non-script targets; dedupe into weighted edges.
- **build-graph** — file nodes + folder (compound) nodes + edges → `GraphModel` JSON.
- **render-html** — inline the model and the bundled Cytoscape viewer into one HTML file.

See [`CONTEXT.md`](./CONTEXT.md) for terminology and [`docs/adr/`](./docs/adr) for the key
design decisions.
