import { ParseFileMode, parseFile } from "~/parseFile";
import { findCommonRoot, findPackageDotJsonDir, loadConfig, usage, verbose } from "~/utils";
import Export from "~/Export";
import Options from "~/Options";
import assert from "assert";
import fs from "fs";
import minimist from "minimist";
import path from "path";

const args = minimist(process.argv.slice(1));

if (args._.length !== 3) {
    usage(console.error.bind(console));
    process.exit(1);
}

const srcFile = path.resolve(args._[1]);
const symbol = args._[2];

const explicitSrcRoot = true;
const root = findPackageDotJsonDir(srcFile ? path.dirname(srcFile) : process.cwd());
if (!root) {
    console.error("Can't find root");
    process.exit(1);
}
const options: Options = loadConfig(
    {
        tilde: args.tilde,
        "src-root": args["src-root"] || root,
        verbose: args.verbose
    },
    root
);

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

const files: string[] = [];
const dirs: string[] = [];

function gather(dir: string): void {
    let found = false;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((f) => {
        if (f.isFile()) {
            if (f.name.substr(-3) === ".ts" && f.name.substr(-5) !== ".d.ts") {
                const file = path.resolve(path.join(dir, f.name));
                if (file !== srcFile) {
                    files.push(file);
                    found = true;
                    // parseFile(file, false);
                }
            }
        } else if (f.isDirectory() && f.name !== "node_modules") {
            gather(path.join(dir, f.name));
        }
        // console.log(f.name, f.isDirectory());
    });
    if (found) {
        dirs.push(dir);
    }
}
assert(options["src-root"]);
gather(options["src-root"]);

if (!explicitSrcRoot) {
    options["src-root"] = findCommonRoot(dirs);
    verbose("Got common root", options["src-root"]);
}

// console.log("got files", files);
// console.log("got dirs", dirs);

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
