import { defineConfig } from "tsup";

// Two bundles:
//  - viewer: a browser IIFE (cytoscape + extensions inlined) that the CLI injects
//    into the generated self-contained HTML file.
//  - cli: the Node ESM entry point. It reads the built viewer bundle at runtime
//    (sibling file in dist/) and inlines it, so the viewer must build first.
export default defineConfig([
  {
    entry: { viewer: "src/render/viewer.ts" },
    format: ["iife"],
    platform: "browser",
    globalName: "ImportExplorerViewer",
    outDir: "dist",
    minify: true,
    clean: true,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    platform: "node",
    target: "node18",
    outDir: "dist",
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
