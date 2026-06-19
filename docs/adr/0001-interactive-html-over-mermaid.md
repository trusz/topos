# 1. Interactive HTML viewer instead of static Mermaid

Status: accepted

## Context

The core feature is *collapsing a module (folder)*: the user folds a subtree into one
node and its import edges re-aggregate into weighted, directional edges on the box, with
incoming imports re-pointed to it. This is an interactive operation — the same graph has
many possible collapse states.

Mermaid (and any static diagram format) renders one fixed picture. Supporting collapse
with Mermaid would mean re-running the CLI per collapse state and regenerating a diagram,
with no live interaction and no in-place re-aggregation.

## Decision

Emit a single **self-contained interactive HTML file** with the graph rendered by
**Cytoscape.js**. Collapse/expand and edge aggregation happen live in the browser. The
file inlines all JS/data so it works offline with no external requests.

## Consequences

- The collapse feature works as specified, live, with no re-invocation.
- The output is a ~0.5 MB HTML file rather than a few lines of Mermaid text — it cannot be
  pasted into a Markdown doc or rendered by GitHub.
- We depend on a browser to view results (acceptable for a visualization tool).
- A future `--mermaid` static exporter remains possible: the analysis produces a stable
  JSON graph model, so a second renderer could consume it without touching the analyzer.
