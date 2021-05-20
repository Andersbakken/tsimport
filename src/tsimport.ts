import { findCommonRoot, findPackageDotJsonDir, gather, loadConfig, usage, verbose } from "~/utils";
import Options from "~/Options";
import assert from "assert";
import fs from "fs";
import minimist from "minimist";
import path from "path";
import processSrcFile from "~/processSrcFile";

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
const checkExports = args["check-exports"];
let root: string | undefined;
let srcFile: string | undefined;
if (checkExports) {
    root;
    if (args._.length === 1) {
        try {
            const stat = fs.statSync(args._[0]);
            if (stat.isFile()) {
                root = findPackageDotJsonDir(path.dirname(args._[0]));
            } else if (stat.isDirectory()) {
                root = findPackageDotJsonDir(args._[0]);
            } else {
                throw new Error("Bad");
            }
        } catch (err) {
            console.error("What is this?", args._[0]);
        }
    } else {
        root = findPackageDotJsonDir(process.cwd());
    }
    if (!root) {
        console.error("Can't find package.json");
        process.exit(1);
    }
} else {
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
    srcFile = path.resolve(args._[1]);

    root = findPackageDotJsonDir(path.dirname(srcFile));
    if (!root) {
        console.error("Can't find root");
        process.exit(1);
    }
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

assert(options["src-root"]);
const dirs: string[] = [];
const files: string[] = [];
gather(options["src-root"], srcFile, dirs, files);

if (!options.explicitSrcRoot) {
    options["src-root"] = findCommonRoot(dirs);
    verbose("Got common root", options["src-root"]);
}

if (srcFile) {
    processSrcFile(args, options, srcFile, symbol, files);
}
