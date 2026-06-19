import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { Project, Node, ts } from "ts-morph";
import { parse as parseVue } from "@vue/compiler-sfc";
import { parse as parseSvelte } from "svelte/compiler";
import type { ExtractedFile, RawSpecifier, SpecifierKind, AnalysisWarning } from "./types.js";

/**
 * Extracts raw module specifiers from a set of files. Per-framework unwrappers
 * pull plain TS/JS script text out of .vue/.svelte files first; everything then
 * goes through one shared ts-morph parser.
 */
export class Extractor {
  private project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve },
  });
  public warnings: AnalysisWarning[] = [];
  private counter = 0;

  extract(file: string): ExtractedFile {
    const script = this.unwrap(file);
    const specifiers = script ? this.parseSpecifiers(script, file) : [];
    return { file, specifiers };
  }

  /** Return plain TS/JS script text for a file, or null if nothing to parse. */
  private unwrap(file: string): string | null {
    const ext = extname(file).toLowerCase();
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      this.warnings.push({ file, message: "Could not read file" });
      return null;
    }

    if (ext === ".vue") return unwrapVue(source, file, this.warnings);
    if (ext === ".svelte") return unwrapSvelte(source, file, this.warnings);
    return source; // .ts .tsx .js .jsx .mjs .cjs
  }

  private parseSpecifiers(script: string, file: string): RawSpecifier[] {
    // Parse as TSX so both TypeScript and JSX syntax are accepted.
    const sf = this.project.createSourceFile(`__virtual_${this.counter++}.tsx`, script, {
      overwrite: true,
    });

    const out: RawSpecifier[] = [];

    for (const imp of sf.getImportDeclarations()) {
      const specifier = imp.getModuleSpecifierValue();
      let kind: SpecifierKind;
      if (imp.isTypeOnly()) kind = "type";
      else if (!imp.getImportClause()) kind = "sideeffect";
      else kind = "static";
      out.push({ specifier, kind });
    }

    for (const exp of sf.getExportDeclarations()) {
      const specifier = exp.getModuleSpecifierValue();
      if (!specifier) continue; // local re-export without a module
      out.push({ specifier, kind: exp.isTypeOnly() ? "type" : "reexport" });
    }

    // Dynamic import() and require() — collected (off by default downstream).
    sf.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        if (expr.getKind() === ts.SyntaxKind.ImportKeyword) {
          const lit = firstStringArg(node);
          if (lit !== null) out.push({ specifier: lit, kind: "dynamic" });
        } else if (Node.isIdentifier(expr) && expr.getText() === "require") {
          const lit = firstStringArg(node);
          if (lit !== null) out.push({ specifier: lit, kind: "require" });
        }
      }
    });

    return out;
  }
}

function firstStringArg(call: Node): string | null {
  if (!Node.isCallExpression(call)) return null;
  const arg = call.getArguments()[0];
  return arg && Node.isStringLiteral(arg) ? arg.getLiteralText() : null;
}

/** Concatenate <script> and <script setup> blocks of a Vue SFC. */
function unwrapVue(source: string, file: string, warnings: AnalysisWarning[]): string | null {
  try {
    const { descriptor, errors } = parseVue(source, { filename: file });
    if (errors.length) warnings.push({ file, message: `Vue parse: ${errors[0].message}` });
    const parts = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  } catch (e) {
    warnings.push({ file, message: `Vue parse failed: ${(e as Error).message}` });
    return null;
  }
}

/** Concatenate the instance and module <script> blocks of a Svelte component. */
function unwrapSvelte(source: string, file: string, warnings: AnalysisWarning[]): string | null {
  try {
    const ast = parseSvelte(source) as SvelteAst;
    const parts: string[] = [];
    for (const block of [ast.instance, ast.module]) {
      const content = block?.content;
      if (content && typeof content.start === "number" && typeof content.end === "number") {
        parts.push(source.slice(content.start, content.end));
      }
    }
    return parts.length ? parts.join("\n") : null;
  } catch (e) {
    warnings.push({ file, message: `Svelte parse failed: ${(e as Error).message}` });
    return null;
  }
}

interface SvelteScriptBlock {
  content?: { start: number; end: number };
}
interface SvelteAst {
  instance?: SvelteScriptBlock;
  module?: SvelteScriptBlock;
}
