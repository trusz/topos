import fastGlob from "fast-glob";
import ignore from "ignore";
import { readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const SCRIPT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
] as const;

const GLOB_PATTERN = "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte}";

export interface DiscoverOptions {
  /** Honor .gitignore files found under the root. Default true. */
  gitignore?: boolean;
  /** Extra glob patterns (relative to root) to exclude, e.g. "**\/*.test.ts". */
  exclude?: string[];
}

/**
 * Walk `root` recursively and return the absolute paths of all script files,
 * skipping node_modules, user-provided exclude globs, and (optionally) anything
 * ignored by .gitignore.
 */
export function discover(root: string, options: DiscoverOptions = {}): string[] {
  const honorGitignore = options.gitignore !== false;

  const entries = fastGlob.sync(GLOB_PATTERN, {
    cwd: root,
    absolute: true,
    dot: false,
    ignore: ["**/node_modules/**", ...(options.exclude ?? [])],
    followSymbolicLinks: false,
  });

  if (!honorGitignore) return entries.sort();

  const ig = loadGitignore(root);
  if (!ig) return entries.sort();

  return entries
    .filter((abs) => {
      const rel = relative(root, abs).split(sep).join("/");
      return rel.length > 0 && !ig.ignores(rel);
    })
    .sort();
}

/** Load the root .gitignore into an `ignore` matcher, if present. */
function loadGitignore(root: string): ReturnType<typeof ignore> | null {
  const gitignorePath = join(root, ".gitignore");
  if (!existsSync(gitignorePath)) return null;
  const ig = ignore();
  ig.add(readFileSync(gitignorePath, "utf8"));
  return ig;
}
