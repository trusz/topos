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
  --json                also write the graph model as JSON next to the HTML
```

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
