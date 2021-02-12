import { ParseFileMode, parseFile } from "~/parseFile";
import { findCommonRoot, findPackageDotJsonDir, gather, loadConfig, usage, verbose } from "~/utils";
import Export from "~/Export";
import ImportModule from "~/ImportModule";
import Options from "~/Options";
import assert from "assert";
import fs from "fs";
import minimist from "minimist";
import path from "path";

const args = minimist(process.argv.slice(1));
if (args.help) {
    usage(console.log.bind(console));
    process.exit(0);
}

if (args.complete === true) {
    args.complete = "";
} else if (args.complete !== undefined && typeof args.complete !== "string") {
    usage(console.error.bind(console));
    console.error(`--complete takes an optional string`);
    process.exit(1);
}

let symbol: string | undefined;
if (args._.length === 1) {
    console.error("Nothing to do");
    process.exit(1);
} else if (args._.length === 2) {
    if (args.complete === undefined) {
        console.error("Nothing to do");
        usage(console.error.bind(console));
        process.exit(1);
    }
} else {
    symbol = args._[2];
}
const srcFile = path.resolve(args._[1]);

const root = findPackageDotJsonDir(path.dirname(srcFile));
if (!root) {
    console.error("Can't find root");
    process.exit(1);
}
const options: Options = loadConfig(
    {
        tilde: args.tilde,
        "src-root": args["src-root"] || root,
        verbose: args.verbose || args.v,
        explicitSrcRoot: typeof args["src-root"] === "string",
        "in-place": args["in-place"] || args.i
    },
    root
);

const files: string[] = [];
const dirs: string[] = [];
const allExports = new Map<string, Export[]>();

function addExport(name: string, def: boolean, file: string): void {
    verbose(`Added export ${name}${def ? " default" : ""} ${file}`);
    const cur = allExports.get(name);
    const exp = new Export(def, file);
    if (!cur) {
        allExports.set(name, [exp]);
    } else {
        cur.push(exp);
    }
}

function processFiles() {
    // console.log(parsed);
    files.forEach((f: string) => {
        const p = parseFile(f, ParseFileMode.Exports, options);
        if (p) {
            // console.log(file)
            if (p.defaultExport) {
                addExport(p.defaultExport, true, p.path);
            }

            if (p.namedExports) {
                p.namedExports.forEach((exp) => {
                    addExport(exp, false, p.path);
                });
            }
        }
    });
}

assert(options["src-root"]);
gather(options["src-root"], srcFile, dirs, files);

if (!options.explicitSrcRoot) {
    options["src-root"] = findCommonRoot(dirs);
    verbose("Got common root", options["src-root"]);
}

const parsed = parseFile(srcFile, ParseFileMode.Imports, options);
if (args.complete !== undefined) {
    processFiles();
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

processFiles();
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
    if (found) {
        console.log("Found export at", found);
    } else {
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
let importModule: ImportModule | undefined;
if (parsed.imports) {
    for (let idx = 0; idx < parsed.imports.length; ++idx) {
        verbose("comparing", parsed.imports[idx].path, found.path);
        if (parsed.imports[idx].path === found.path) {
            importModule = parsed.imports[idx];
            insertPoint = undefined;
            // console.error("Already have it", parsed.imports[idx]);
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
    } else if (importModule.named) {
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
    newSrc = `${parsed.sourceCode.substr(0, insertPoint)}import ${symbol} from "${found.path}";\n${
        insertPoint === 0 ? "\n" : ""
    }${parsed.sourceCode.substr(insertPoint)}`;
} else {
    assert(insertPoint !== undefined);
    newSrc = `${parsed.sourceCode.substr(0, insertPoint)}import { ${symbol} } from "${found.path}";\n${
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
        console.error("Failed to write changes", err.message);
        process.exit(1);
    }
} else {
    console.log(newSrc);
}
