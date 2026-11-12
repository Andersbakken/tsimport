import { ParseFileMode, parseFile } from "./parseFile";
import { verbose } from "./utils";
import Export from "./Export";
import File from "./File";
import Import from "./Import";
import Options from "./Options";
import assert from "assert";
import path from "path";

// Turn a file path or a resolved import path into a key that both sides
// agree on: absolute, no extension, no trailing /index
function moduleKey(p: string): string {
    p = p.replace(/\.d\.ts$/, "").replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
    if (p.endsWith("/index")) {
        p = p.substring(0, p.length - 6);
    }
    return p;
}

// Resolve the module specifier of an import relative to the importing file,
// returns undefined for things like packages that we can't map to a file.
function resolveImport(fromFile: string, specifier: string, srcRoot: string): string | undefined {
    if (specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../")) {
        return moduleKey(path.resolve(path.dirname(fromFile), specifier));
    }
    if (specifier.startsWith("~/")) {
        return moduleKey(path.resolve(srcRoot, specifier.substring(2)));
    }
    return undefined;
}

interface Usage {
    module: string;
    // undefined means everything (import * as foo / export * from)
    names?: string[];
    default: boolean;
}

function importUsage(file: File, imp: Import, srcRoot: string): Usage | undefined {
    const module = resolveImport(file.path, imp.path, srcRoot);
    if (!module) {
        return undefined;
    }
    if (imp.default === "*") {
        return { module, default: true };
    }
    const names = imp.named.filter((n: string) => n !== "default");
    return { module, names, default: Boolean(imp.default) || names.length !== imp.named.length };
}

// export * from "./foo";  export { a, b as c } from "./foo";
function reExportUsages(file: File, srcRoot: string): Usage[] {
    const ret: Usage[] = [];
    const rx = /^export\s+(?:type\s+)?(\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/gm;
    let match;
    while ((match = rx.exec(file.sourceCode))) {
        const module = resolveImport(file.path, match[2], srcRoot);
        if (!module) {
            continue;
        }
        if (match[1][0] === "*") {
            // export * doesn't re-export the default, export * as ns does
            ret.push({ module, default: match[1] !== "*" });
            continue;
        }
        const names = match[1]
            .substring(1, match[1].length - 1)
            .split(",")
            .map((x: string) =>
                x
                    .trim()
                    .replace(/^type\s+/, "")
                    .replace(/\s+as\s+.*$/, "")
            )
            .filter((x: string) => x);
        const named = names.filter((n: string) => n !== "default");
        ret.push({ module, names: named, default: named.length !== names.length });
    }
    return ret;
}

export default function findUnused(options: Options, fileNames: string[]): boolean {
    verbose("findUnused called", options, fileNames);
    const srcRoot = options["src-root"];
    assert(srcRoot);
    // module key -> name (or "default") -> export
    const exports = new Map<string, Map<string, Export>>();
    const usages: Usage[] = [];
    fileNames.forEach((f: string) => {
        const p: File | undefined = parseFile(f, ParseFileMode.Imports | ParseFileMode.Exports, options);
        if (!p) {
            return;
        }
        const key = moduleKey(p.path);
        let fileExports = exports.get(key);
        if (!fileExports) {
            fileExports = new Map<string, Export>();
            exports.set(key, fileExports);
        }
        if (p.namedExports) {
            for (const exp of p.namedExports) {
                fileExports.set(exp.name, exp);
                verbose(`Adding named ${key}:${exp.name}`);
            }
        }
        if (p.defaultExport) {
            fileExports.set("default", p.defaultExport);
            verbose(`Adding default ${key}:${p.defaultExport.name}`);
        }

        if (p.imports) {
            for (const imp of p.imports) {
                const usage = importUsage(p, imp, srcRoot);
                if (usage) {
                    usages.push(usage);
                }
            }
        }
        usages.push(...reExportUsages(p, srcRoot));
    });

    for (const usage of usages) {
        const fileExports = exports.get(usage.module);
        if (!fileExports) {
            verbose(`No exports known for ${usage.module}`);
            continue;
        }
        if (!usage.names) {
            // import * as foo from "./foo" uses everything, export * from
            // "./foo" uses everything but the default
            verbose(`Removing all exports from ${usage.module}`);
            const def = usage.default ? undefined : fileExports.get("default");
            fileExports.clear();
            if (def) {
                fileExports.set("default", def);
            }
            continue;
        }
        for (const name of usage.names) {
            const removed = fileExports.delete(name);
            verbose(`Removing named ${usage.module}:${name} -> ${removed}`);
        }
        if (usage.default) {
            const removed = fileExports.delete("default");
            verbose(`Removing default ${usage.module} -> ${removed}`);
        }
    }

    const unused: Export[] = [];
    for (const fileExports of exports.values()) {
        unused.push(...fileExports.values());
    }

    if (!unused.length) {
        console.log("Didn't find any unimported exports");
        return false;
    }
    unused.sort((a: Export, b: Export) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
    for (const exp of unused) {
        console.log(
            `${exp.path}:${exp.line}: warning: ${exp.default ? "Default" : "Named"} export ${
                exp.name
            } is never imported`
        );
    }
    return true;
}
