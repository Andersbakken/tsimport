import { ParseFileMode, parseFile } from "./parseFile";
import { findCommonRoot, verbose } from "./utils";
import Export from "./Export";
import File from "./File";
import Import from "./Import";
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
            for (let idx = 0; idx < parsed.imports.length; ++idx) {
                if (parsed.imports[idx].default) {
                    alreadyHave.add(parsed.imports[idx].default);
                }
                if (parsed.imports[idx].named) {
                    parsed.imports[idx].named.forEach((n) => {
                        alreadyHave.add(n);
                    });
                }
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
    if (parsed.imports) {
        for (let idx = 0; idx < parsed.imports.length; ++idx) {
            if (parsed.imports[idx].default && parsed.imports[idx].default === symbol) {
                console.error("Already have it");
                process.exit(0);
            }

            if (parsed.imports[idx].named.indexOf(symbol) !== -1) {
                console.error("Already have it");
                process.exit(0);
            }
        }
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
    let importModule: Import | undefined;
    const fixedPath = fixPath(srcFile, found.path);
    if (parsed.imports) {
        for (let idx = 0; idx < parsed.imports.length; ++idx) {
            verbose("comparing", parsed.imports[idx].path, fixedPath);
            if (parsed.imports[idx].path === fixedPath) {
                importModule = parsed.imports[idx];
                insertPoint = undefined;
                verbose("Already have it", parsed.imports[idx]);
                break;
            }
            insertPoint = parsed.sourceCode.indexOf("\n", parsed.imports[idx].end) + 1;
        }
    } else {
        insertPoint = 0;
    }

    let newSrc: string;
    if (importModule) {
        if (found.default) {
            // we already have named imports but not the default import,
            // it needs to go before the {}
            assert(!importModule.default);
            assert(importModule.named.length);

            const idx = parsed.sourceCode.indexOf("{", importModule.start);
            newSrc = `${parsed.sourceCode.substr(0, idx)}${symbol}, ${parsed.sourceCode.substr(idx)}`;
        } else if (importModule.named.length) {
            // we already have named imports but not this one, rewrite
            // sorted
            const startBrace = parsed.sourceCode.indexOf("{", importModule.start);
            const endBrace = parsed.sourceCode.indexOf("}", startBrace);
            importModule.named.push(symbol);
            importModule.named.sort();
            newSrc = `${parsed.sourceCode.substr(0, startBrace)}{ ${importModule.named.join(
                ", "
            )} }${parsed.sourceCode.substr(endBrace + 1)}`;
        } else {
            // we already have a default import but no named one it needs
            // to go after the default import
            const idx = parsed.sourceCode.indexOf(" from ", importModule.start);
            newSrc = `${parsed.sourceCode.substr(0, idx)}, { ${symbol} }${parsed.sourceCode.substr(idx)}`;
        }
    } else if (found.default) {
        assert(insertPoint !== undefined);
        newSrc = `${parsed.sourceCode.substr(0, insertPoint)}import ${symbol} from "${fixedPath}";\n${
            insertPoint === 0 ? "\n" : ""
        }${parsed.sourceCode.substr(insertPoint)}`;
    } else {
        assert(insertPoint !== undefined);
        newSrc = `${parsed.sourceCode.substr(0, insertPoint)}import { ${symbol} } from "${fixedPath}";\n${
            insertPoint === 0 ? "\n" : ""
        }${parsed.sourceCode.substr(insertPoint)}`;
    }

    if (options["in-place"]) {
        console.log(options["in-place"]);
        try {
            if (typeof options["in-place"] === "string") {
                fs.writeFileSync(srcFile + options["in-place"], parsed.sourceCode);
            }
            fs.writeFileSync(srcFile, newSrc);
        } catch (err) {
            console.error("Failed to write changes", (err as Error).message);
            process.exit(1);
        }
    } else {
        console.log(newSrc);
    }
}
