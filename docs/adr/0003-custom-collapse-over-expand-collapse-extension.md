# 3. Custom collapse/aggregation instead of cytoscape-expand-collapse

Status: accepted

## Context

The obvious way to get collapsible compound nodes in Cytoscape is the
`cytoscape-expand-collapse` extension, and the project initially used it. Two problems
surfaced in testing:

1. **It does not aggregate node-collapse edges.** Collapsing a folder re-routes each
   crossing import as a *separate* parallel meta-edge; `groupEdgesOfSameTypeOnCollapse`
   only applies to explicit edge-collapsing, not node collapse. The spec requires a single
   weighted edge per direction.
2. **It crashes on nested collapse.** Collapsing a folder whose subtree already contains a
   collapsed folder throws `Cannot read properties of undefined (reading 'index')` from
   the renderer (dangling meta-edge endpoints). The corruption persists even after
   expanding the inner folder. Nested collapsing is a core requirement, so this is fatal.

## Decision

Drop the extension. Keep the immutable graph model plus a `Set` of collapsed folder ids,
and **recompute the displayed graph from scratch on every change**: a node is hidden if any
ancestor is collapsed; every import edge is mapped onto its representative (topmost
collapsed ancestor, else itself); edges internal to a collapse are dropped; the rest are
aggregated by endpoint pair with summed weights. `cytoscape-fcose` still does layout.

## Consequences

- Exactly matches the spec: subtree-summarized outgoing edges, incoming edges re-pointed to
  the module, internal edges hidden, weighted directional aggregated edges, A→B and B→A
  separate.
- Arbitrary nested collapse/expand works and round-trips deterministically; no extension
  state to corrupt.
- One fewer dependency (~30 KB smaller bundle).
- We re-run layout on each toggle (positions are preserved where node ids persist), which
  is simpler than incremental mutation and fast at these graph sizes.
