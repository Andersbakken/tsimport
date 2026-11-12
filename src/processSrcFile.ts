import { ParseFileMode, parseFile } from "./parseFile";
import { findCommonRoot, verbose } from "./utils";
import Export from "./Export";
import File from "./File";
import Import, { NamedImport } from "./Import";
import Options from "./Options";
import assert from "assert";
import fs from "fs";
import minimist from "minimist";
import path from "path";

function addExport(allExports: Map<string, Export[]>, exp: Export): void {
    verbose(`Added export ${exp.name}${exp.default ? " default" : ""} ${exp.path}`);
    const cur = allExports.get(exp.name);
    if (!cur) {
        allExports.set(exp.name, [exp]);
    } else {
        cur.push(exp);
    }
}

function processFiles(fileNames: string[], options: Options): Map<string, Export[]> {
    const allExports = new Map<string, Export[]>();
    // console.log(parsed);
    const files: File[] = [];
    fileNames.forEach((f: string) => {
        const p = parseFile(f, ParseFileMode.Exports, options);
        if (p) {
            files.push(p);
        }
    });

    files.forEach((p: File) => {
        // console.log(file)
        if (p.defaultExport) {
            addExport(allExports, p.defaultExport);
        }

        if (p.namedExports) {
            p.namedExports.forEach((exp: Export) => {
                addExport(allExports, exp);
            });
        }
    });
    return allExports;
}

function fixPath(srcFile: string, importPath: string): string {
    if (importPath.startsWith("~/")) {
        return importPath;
    }

    let relative = path.relative(path.dirname(srcFile), importPath);
    // console.log(relative);
    if (!relative.startsWith(".")) {
        relative = "./" + relative;
    }
    if (relative.endsWith(".d.ts")) {
        relative = relative.substring(0, relative.length - 5);
    } else if (relative.endsWith(".ts")) {
        relative = relative.substring(0, relative.length - 3);
    }
    if (relative.endsWith("/index")) {
        relative = relative.substring(0, relative.length - 6);
    }
    return relative;
}

interface Edit {
    start: number;
    end: number;
    text: string;
}

function applyEdits(src: string, edits: Edit[]): string {
    edits.sort((a: Edit, b: Edit) => b.start - a.start);
    for (const edit of edits) {
        src = `${src.substring(0, edit.start)}${edit.text}${src.substring(edit.end)}`;
    }
    return src;
}

function lineAfter(src: string, pos: number): number {
    const nl = src.indexOf("\n", pos);
    return nl === -1 ? src.length : nl + 1;
}

function stripInlineType(text: string): string {
    return text.replace(/^type\s+/, "");
}

// rewrite the {} part of an import with the given specifiers, sorted by name
function bracesEdit(src: string, imp: Import, specifiers: NamedImport[]): Edit {
    const startBrace = src.indexOf("{", imp.start);
    const endBrace = src.indexOf("}", startBrace);
    const sorted = specifiers
        .slice()
        .sort((a: NamedImport, b: NamedImport) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return {
        start: startBrace,
        end: endBrace + 1,
        text: `{ ${sorted.map((x: NamedImport) => x.text).join(", ")} }`
    };
}

// add symbol (named or default) to an existing value import
function addToImportEdit(src: string, imp: Import, symbol: string, text: string, isDefault: boolean): Edit {
    if (isDefault) {
        // we already have named imports but not the default import,
        // it needs to go before the {}
        assert(!imp.default);
        assert(imp.named.length);
        const idx = src.indexOf("{", imp.start);
        return { start: idx, end: idx, text: `${symbol}, ` };
    }
    if (imp.named.length) {
        // we already have named imports but not this one, rewrite sorted
        return bracesEdit(src, imp, [...imp.specifiers, { name: symbol, text, isType: false }]);
    }
    // we already have a default import but no named one it needs to go
    // after the default import
    const fromMatch = /\s+from\s/.exec(src.substring(imp.start, imp.end));
    assert(fromMatch);
    const idx = imp.start + fromMatch.index;
    return { start: idx, end: idx, text: `, { ${text} }` };
}

function isValueImport(imp: Import): boolean {
    return !imp.typeOnly && imp.default !== "*";
}

export default function processSrcFile(
    args: minimist.ParsedArgs,
    options: Options,
    srcFile: string,
    symbol: string | undefined,
    files: string[]
): void {
    const allExports = processFiles(files, options);
    const parsed = parseFile(srcFile, ParseFileMode.Imports, options);
    if (args.complete !== undefined) {
        let keys = Array.from(allExports.keys());
        if (parsed && parsed.imports) {
            const alreadyHave = new Set();
            // type-only imports are still candidates since importing them
            // again turns them into value imports
            for (let idx = 0; idx < parsed.imports.length; ++idx) {
                const imp = parsed.imports[idx];
                if (imp.typeOnly) {
                    continue;
                }
                if (imp.default) {
                    alreadyHave.add(imp.default);
                }
                imp.specifiers.forEach((s: NamedImport) => {
                    if (!s.isType) {
                        alreadyHave.add(s.name);
                    }
                });
            }
            keys = keys.filter((k) => {
                return !alreadyHave.has(k);
            });
        }
        if (!args.complete) {
            console.log(keys.sort().join("\n"));
            process.exit(0);
        }

        keys = keys
            .filter((s) => {
                return s.lastIndexOf(args.complete, 0) === 0;
            })
            .sort();
        if (!keys.length) {
            console.error(`Can't find completion for "${args.complete}"`);
            process.exit(1);
        }

        if (keys.length === 1) {
            if (keys[0] !== args.complete) {
                console.log(keys[0]);
            }

            process.exit(0);
        }

        const commonRoot = findCommonRoot(keys);
        if (commonRoot !== args.complete) {
            console.log(commonRoot);
            process.exit(0);
        }

        console.log(keys.join("\n"));
        process.exit(0);
    }

    // console.log("got files", files);
    // console.log("got dirs", dirs);

    if (!parsed) {
        console.error("Can't parse", srcFile);
        process.exit(1);
    }

    assert(symbol);
    let typeImport: Import | undefined;
    let typeSpecifier: NamedImport | undefined;
    if (parsed.imports) {
        for (let idx = 0; idx < parsed.imports.length; ++idx) {
            const imp = parsed.imports[idx];
            if (imp.default && imp.default === symbol) {
                if (!imp.typeOnly) {
                    reportAlreadyHave(options, parsed.sourceCode);
                    return;
                }
                typeImport = imp;
                typeSpecifier = undefined;
            }

            const spec = imp.specifiers.find((s: NamedImport) => s.name === symbol);
            if (spec) {
                if (!imp.typeOnly && !spec.isType) {
                    reportAlreadyHave(options, parsed.sourceCode);
                    return;
                }
                typeImport = imp;
                typeSpecifier = spec;
            }
        }
    }

    if (typeImport) {
        // We have it as a type-only import, turn it into a value import
        verbose("Converting type import to value import", typeImport);
        const src = parsed.sourceCode;
        const edits: Edit[] = [];
        if (!typeImport.typeOnly) {
            // import { type Foo } from "..." => import { Foo } from "..."
            assert(typeSpecifier);
            const spec = typeSpecifier;
            edits.push(
                bracesEdit(
                    src,
                    typeImport,
                    typeImport.specifiers.map((s: NamedImport) =>
                        s === spec ? { name: s.name, text: stripInlineType(s.text), isType: false } : s
                    )
                )
            );
        } else if (!typeSpecifier || typeImport.specifiers.length === 1) {
            // import type Foo from "..." => import Foo from "..."
            // import type { Foo } from "..." => import { Foo } from "..."
            const match = /^import\s+type\s+/.exec(src.substring(typeImport.start, typeImport.end));
            assert(match);
            edits.push({ start: typeImport.start, end: typeImport.start + match[0].length, text: "import " });
        } else {
            // import type { Bar, Foo } from "..." =>
            // import type { Bar } from "...";
            // import { Foo } from "...";
            const spec = typeSpecifier;
            const text = stripInlineType(spec.text);
            edits.push(
                bracesEdit(
                    src,
                    typeImport,
                    typeImport.specifiers.filter((s: NamedImport) => s !== spec)
                )
            );
            const ti = typeImport;
            const valueImport = (parsed.imports || []).find(
                (imp: Import) => imp.path === ti.path && isValueImport(imp)
            );
            if (valueImport) {
                edits.push(addToImportEdit(src, valueImport, symbol, text, false));
            } else {
                const pos = lineAfter(src, typeImport.end);
                const prefix = pos === src.length && !src.endsWith("\n") ? "\n" : "";
                edits.push({ start: pos, end: pos, text: `${prefix}import { ${text} } from "${typeImport.path}";\n` });
            }
        }
        writeResult(options, srcFile, parsed.sourceCode, applyEdits(src, edits));
        return;
    }

    const symbolExport = allExports.get(symbol);
    if (!symbolExport) {
        console.error(`Can't find symbol ${symbol}`);
        process.exit(1);
    }

    let found: Export | undefined;
    if (symbolExport.length > 1) {
        for (let idx = 0; idx < symbolExport.length; ++idx) {
            if (symbolExport[idx].default) {
                if (found) {
                    console.error(`Found multiple exports for ${symbol}\n${found} and ${symbolExport[idx].path}`);
                    process.exit(1);
                } else {
                    found = symbolExport[idx];
                }
            }
        }
        if (!found) {
            console.error(
                `Found multiple exports for ${symbol}\n${symbolExport
                    .map((e: Export) => {
                        return e.path;
                    })
                    .join("\n")}`
            );
            process.exit(1);
        }
    } else {
        assert(symbolExport.length === 1);
        found = symbolExport[0];
    }

    assert(found);
    verbose("Found", symbol, "at", found);
    let insertPoint: number | undefined;
    let prefix = "";
    let suffix = "";
    let importModule: Import | undefined;
    const fixedPath = fixPath(srcFile, found.path);
    if (parsed.imports) {
        for (let idx = 0; idx < parsed.imports.length; ++idx) {
            verbose("comparing", parsed.imports[idx].path, fixedPath);
            // can't add value imports to `import type` or `import * as`
            if (parsed.imports[idx].path === fixedPath && isValueImport(parsed.imports[idx])) {
                importModule = parsed.imports[idx];
                insertPoint = undefined;
                verbose("Already have it", parsed.imports[idx]);
                break;
            }
            insertPoint = parsed.sourceCode.indexOf("\n", parsed.imports[idx].end) + 1;
        }
    } else {
        insertPoint = parsed.sourceCode.lastIndexOf("/// <reference path=");
        if (insertPoint === -1) {
            insertPoint = 0;
            if (parsed.sourceCode.startsWith("/*")) {
                insertPoint = parsed.sourceCode.indexOf("*/") + 3;
                prefix = "\n";
                suffix = "\n";
            } else if (parsed.sourceCode.startsWith("//")) {
                insertPoint = parsed.sourceCode.indexOf("\n") + 1;
                prefix = "\n";
                suffix = "\n";
            }
        }
    }

    let newSrc: string;
    if (importModule) {
        newSrc = applyEdits(parsed.sourceCode, [
            addToImportEdit(parsed.sourceCode, importModule, symbol, symbol, Boolean(found.default))
        ]);
    } else if (found.default) {
        assert(insertPoint !== undefined);
        newSrc = `${parsed.sourceCode.substr(
            0,
            insertPoint
        )}${prefix}import ${symbol} from "${fixedPath}";\n${suffix}${parsed.sourceCode.substr(insertPoint)}`;
    } else {
        assert(insertPoint !== undefined);
        newSrc = `${parsed.sourceCode.substr(
            0,
            insertPoint
        )}${prefix}import { ${symbol} } from "${fixedPath}";\n${suffix}${parsed.sourceCode.substr(insertPoint)}`;
    }

    writeResult(options, srcFile, parsed.sourceCode, newSrc);
}

function writeResult(options: Options, srcFile: string, oldSrc: string, newSrc: string): void {
    if (options["in-place"]) {
        try {
            if (typeof options["in-place"] === "string") {
                fs.writeFileSync(srcFile + options["in-place"], oldSrc);
            }
            fs.writeFileSync(srcFile, newSrc);
        } catch (err) {
            console.error("Failed to write changes", (err as Error).message);
            process.exit(1);
        }
    } else {
        process.stdout.write(newSrc);
    }
}

// Nothing to do. Still echo the source so that callers that replace the
// file/buffer with our output don't end up with an empty file. Don't call
// process.exit() here, stdout may be an async pipe and we'd truncate.
function reportAlreadyHave(options: Options, src: string): void {
    console.error("Already have it");
    if (!options["in-place"]) {
        process.stdout.write(src);
    }
}
