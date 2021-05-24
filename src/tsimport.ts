import { findCommonRoot, findPackageDotJsonDir, gather, loadConfig, usage, verbose } from "~/utils";
import Options from "~/Options";
import assert from "assert";
import findUnused from "~/findUnused";
import minimist from "minimist";
import path from "path";
import processSrcFile from "~/processSrcFile";

const args = minimist(process.argv.slice(2)); // , { boolean: ["v", "verbose", "find-unused-exports", "u"] });
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
const unused = args["find-unused-exports"] || args.u;
let root: string | undefined;
let srcFile: string | undefined;
if (unused) {
    root = args["src-root"] || findPackageDotJsonDir(process.cwd());
} else {
    if (args._.length === 0) {
        console.error("Nothing to do");
        usage(console.error.bind(console));
        process.exit(1);
    } else if (args._.length === 1) {
        if (args.complete === undefined) {
            console.error("Nothing to do");
            usage(console.error.bind(console));
            process.exit(1);
        }
    } else {
        symbol = args._[1];
    }
    srcFile = path.resolve(args._[0]);

    root = findPackageDotJsonDir(path.dirname(srcFile));
}

if (!root) {
    console.error("Can't find root");
    process.exit(1);
}

const options: Options = loadConfig(
    {
        tilde: args.tilde,
        explicitTilde: typeof args.tilde !== "undefined",
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
} else {
    assert(unused);
    process.exit(findUnused(options, files) ? 1 : 0);
}
