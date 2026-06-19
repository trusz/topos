import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphModel } from "../types.js";

/**
 * Produce a single self-contained HTML document: the graph data, the bundled
 * Cytoscape viewer (with extensions inlined), and the page chrome. No external
 * requests are made when the file is opened.
 */
export function renderHtml(graph: GraphModel): string {
  const viewerJs = readViewerBundle();
  const dataJson = safeJson(graph);
  const title = `Import graph — ${graph.root}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<header id="toolbar">
  <span class="title">Import Explorer</span>
  <span class="root" title="${escapeHtml(graph.root)}">${escapeHtml(graph.root)}</span>
  <span class="spacer"></span>
  <span class="stats">${graph.nodes.filter((n) => n.type === "file").length} files · ${graph.edges.length} imports</span>
  <button id="collapse-all">Collapse all</button>
  <button id="expand-all">Expand all</button>
  <button id="relayout">Re-layout</button>
  <button id="fit">Fit</button>
</header>
<div id="cy"></div>
<footer id="hint">Click a folder to collapse / expand it. Edge numbers = imports summarized. On each box, <strong>↓</strong> = incoming imports, <strong>↑</strong> = outgoing (for a folder, edges crossing its boundary).</footer>
<script id="graph-data" type="application/json">${dataJson}</script>
<script>${viewerJs}</script>
<script>
  (function () {
    var model = JSON.parse(document.getElementById("graph-data").textContent);
    window.__IMPORT_GRAPH__ = model;
    window.ImportExplorerViewer.mount(model, document.getElementById("cy"));
  })();
</script>
</body>
</html>
`;
}

function readViewerBundle(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // The viewer IIFE bundle is emitted next to the CLI by tsup.
  const candidates = [join(here, "viewer.global.js"), join(here, "..", "dist", "viewer.global.js")];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "Viewer bundle (viewer.global.js) not found next to the CLI. Run `npm run build` first.",
  );
}

/** JSON safe to embed inside a <script> tag. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAGE_CSS = `
:root { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { display: flex; flex-direction: column; height: 100vh; background: #f8fafc; }
#toolbar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
#toolbar .title { font-weight: 700; color: #0f172a; }
#toolbar .root { color: #64748b; font-size: 12px; max-width: 40vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#toolbar .spacer { flex: 1; }
#toolbar .stats { color: #475569; font-size: 12px; margin-right: 6px; }
#toolbar button { font: inherit; font-size: 13px; padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f1f5f9; color: #1e293b; cursor: pointer; }
#toolbar button:hover { background: #e2e8f0; }
#cy { flex: 1; width: 100%; }
#hint { padding: 6px 14px; font-size: 12px; color: #64748b; background: #ffffff; border-top: 1px solid #e2e8f0; }
`;
