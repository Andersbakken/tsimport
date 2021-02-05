import { ParseFileMode, parseFile } from "~/parseFile";
import { findCommonRoot, findPackageDotJsonDir, gather, loadConfig, usage, verbose } from "~/utils";
import Export from "~/Export";
import Options from "~/Options";
import assert from "assert";
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
        explicitSrcRoot: typeof args["src-root"] === "string"
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

if (args.complete !== undefined) {
    processFiles();
    if (!args.complete) {
        console.log(Array.from(allExports.keys()).sort().join("\n"));
        process.exit(0);
    }

    const keys = Array.from(allExports.keys())
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

assert(srcFile);
assert(symbol);
const parsed = parseFile(srcFile, ParseFileMode.Imports, options);
if (!parsed) {
    console.error("Can't parse", srcFile);
    process.exit(1);
}
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

let found: string | undefined;
if (symbolExport.length > 1) {
    for (let idx = 0; idx < symbolExport.length; ++idx) {
        if (symbolExport[idx].default) {
            if (found) {
                console.error(`Found multiple exports for ${symbol}\n${found} and ${symbolExport[idx].path}`);
                process.exit(1);
            } else {
                found = symbolExport[idx].path;
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
    found = symbolExport[0].path;
}

assert(found);
console.log("Found", symbol, "at", found);
