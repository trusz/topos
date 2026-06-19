import { ts, Project, Node } from "ts-morph";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { AnalysisWarning } from "../types.js";

/** A single alias mapping: `prefix` (e.g. "@/" or "@") -> absolute target dir/file. */
export interface AliasEntry {
  prefix: string;
  target: string;
}

export interface ResolvedConfig {
  /** baseUrl from tsconfig, absolute, or null. */
  baseUrl: string | null;
  /** Ordered alias entries (tsconfig paths first, then vite aliases). */
  aliases: AliasEntry[];
  warnings: AnalysisWarning[];
}

/**
 * Build a unified alias map from tsconfig (paths/baseUrl) and vite.config
 * (resolve.alias). Aliases are matched as prefixes during specifier resolution.
 */
export function resolveConfig(root: string, tsconfigPath?: string): ResolvedConfig {
  const warnings: AnalysisWarning[] = [];
  const aliases: AliasEntry[] = [];

  const { baseUrl, pathAliases } = readTsconfig(root, tsconfigPath, warnings);
  aliases.push(...pathAliases);
  aliases.push(...readViteAliases(root, warnings));

  return { baseUrl, aliases, warnings };
}

// --- tsconfig ---

function readTsconfig(
  root: string,
  tsconfigPath: string | undefined,
  warnings: AnalysisWarning[],
): { baseUrl: string | null; pathAliases: AliasEntry[] } {
  const configPath = tsconfigPath
    ? resolve(tsconfigPath)
    : ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");

  if (!configPath || !existsSync(configPath)) {
    return { baseUrl: null, pathAliases: [] };
  }

  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    warnings.push({ message: `Could not read ${configPath}` });
    return { baseUrl: null, pathAliases: [] };
  }

  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    dirname(configPath),
  );
  const opts = parsed.options;
  // After parsing, baseUrl is already absolute.
  const baseUrl = opts.baseUrl ? resolve(opts.baseUrl) : null;
  const aliasBase = baseUrl ?? dirname(configPath);

  const pathAliases: AliasEntry[] = [];
  for (const [pattern, targets] of Object.entries(opts.paths ?? {})) {
    const target = targets?.[0];
    if (!target) continue;
    // Strip the trailing "/*" wildcard from both sides; we match on prefix.
    const prefix = pattern.replace(/\*$/, "");
    const targetPath = target.replace(/\*$/, "");
    pathAliases.push({
      prefix,
      target: isAbsolute(targetPath) ? targetPath : join(aliasBase, targetPath),
    });
  }
  return { baseUrl, pathAliases };
}

// --- vite.config ---

const VITE_CONFIG_NAMES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.mts",
];

function readViteAliases(root: string, warnings: AnalysisWarning[]): AliasEntry[] {
  const configPath = VITE_CONFIG_NAMES.map((n) => join(root, n)).find(existsSync);
  if (!configPath) return [];

  const configDir = dirname(configPath);
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(configPath);

  // Find a property named "alias" anywhere (resolve.alias). Handle both the
  // object form ({ '@': '/abs/src' }) and the array form ([{ find, replacement }]).
  const aliases: AliasEntry[] = [];
  source.forEachDescendant((node) => {
    if (!Node.isPropertyAssignment(node)) return;
    if (node.getName().replace(/['"]/g, "") !== "alias") return;
    const init = node.getInitializer();
    if (!init) return;

    if (Node.isObjectLiteralExpression(init)) {
      for (const prop of init.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) continue;
        const prefix = stripQuotes(prop.getName());
        const target = evalPathExpression(prop.getInitializerOrThrow(), configDir);
        if (target) aliases.push({ prefix, target });
        else warnings.push({ file: configPath, message: `Skipped non-static vite alias "${prefix}"` });
      }
    } else if (Node.isArrayLiteralExpression(init)) {
      for (const el of init.getElements()) {
        if (!Node.isObjectLiteralExpression(el)) continue;
        const find = el.getProperty("find");
        const replacement = el.getProperty("replacement");
        if (!Node.isPropertyAssignment(find) || !Node.isPropertyAssignment(replacement)) continue;
        const findExpr = find.getInitializerOrThrow();
        if (!Node.isStringLiteral(findExpr)) continue; // RegExp finds unsupported
        const prefix = findExpr.getLiteralText();
        const target = evalPathExpression(replacement.getInitializerOrThrow(), configDir);
        if (target) aliases.push({ prefix, target });
        else warnings.push({ file: configPath, message: `Skipped non-static vite alias "${prefix}"` });
      }
    }
  });
  return aliases;
}

/**
 * Best-effort static evaluation of a path-producing expression without executing
 * the config. Handles the common shapes:
 *   '/abs' | './rel'
 *   path.resolve(__dirname, 'src') | join(__dirname, './src')
 *   fileURLToPath(new URL('./src', import.meta.url))
 * Returns an absolute path, or null if it can't be evaluated statically.
 */
function evalPathExpression(node: Node, configDir: string): string | null {
  if (Node.isStringLiteral(node)) {
    const v = node.getLiteralText();
    return isAbsolute(v) ? v : resolve(configDir, v);
  }
  if (Node.isCallExpression(node) || Node.isNewExpression(node)) {
    // Collect string-literal arguments; ignore __dirname / import.meta.url etc.
    const literals: string[] = [];
    for (const arg of node.getArguments()) {
      if (Node.isStringLiteral(arg)) literals.push(arg.getLiteralText());
      else {
        const nested = evalPathExpression(arg, configDir);
        if (nested) literals.push(nested);
      }
    }
    if (literals.length === 0) return null;
    // Join literals onto configDir (path.resolve/join semantics, good enough).
    return resolve(configDir, ...literals);
  }
  return null;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]|['"`]$/g, "");
}
