# 2. Implement in TypeScript/Node, not Go

Status: accepted

## Context

The CLI must parse four source dialects — TypeScript/TSX, Vue SFCs, and Svelte
components — to find imports. Each ecosystem ships an official parser:
`ts-morph`/the TS compiler API, `@vue/compiler-sfc`, and `svelte/compiler`. All are
JavaScript libraries.

Go was considered (single static binary, fast). But Go has no maintained parsers for Vue
SFCs or Svelte, and reimplementing them — or the TypeScript type/alias resolution — would
be a large, fragile effort. A Go CLI would most likely end up shelling out to Node anyway.

## Decision

Build the CLI in **TypeScript on Node**, using each framework's official parser behind a
thin per-framework "unwrapper" that extracts script text, then a single shared `ts-morph`
pass to read import/export specifiers.

## Consequences

- Accurate parsing of all four dialects with maintained, upstream tooling.
- Distribution requires Node (no single static binary).
- The viewer is also TypeScript, bundled to a browser IIFE — one language across the
  whole project.
