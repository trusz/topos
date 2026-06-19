# Context — Import Explorer

A glossary of the domain language used in this project. No implementation details.

## Glossary

- **Module** — a folder. The unit a user collapses/expands. ("Close a module" = collapse a folder.)
- **Node** — a box in the graph. Either a **file** or a **folder/module**.
- **Containment** — the nested-box hierarchy: a folder node visually contains its
  children. Containment is *not* drawn as an edge; it is expressed by nesting.
- **Import edge** — a directed dependency from one file to another, derived from a
  static `import`, a re-export (`export … from`), a side-effect `import './x'`, or a
  type-only `import type { T } from './x'`.
- **Specifier** — the literal string in an import (`'./module2'`, `'@/foo'`). It is
  *resolved* to a file before becoming an import edge.
- **Resolution** — turning a specifier into an actual scanned file, using relative
  paths, index/barrel files, `tsconfig` `paths`/`baseUrl`, and `vite` `resolve.alias`.
- **External** — an import that points outside the scanned project (a `node_modules`
  package) or to a non-script file (`.css`/`.json`/asset). Externals are dropped.
- **Collapse** — fold a module's whole subtree into a single node. Its internal import
  edges are hidden; edges crossing its boundary are re-pointed to the module node.
- **Aggregated edge** (a.k.a. meta edge) — the single directed edge shown between a
  collapsed module and another node, summarizing all underlying imports in that
  direction. Its **weight** is how many imports it summarizes; A→B and B→A stay separate.
- **Weight** — the number of distinct underlying import statements an edge represents.
