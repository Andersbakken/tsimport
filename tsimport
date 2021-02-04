#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const ts =  require("typescript");

const args = require("minimist")(process.argv.slice(1));

function usage(print)
{
    print(`tsimport /path/to/file symbol [--src-root <root>]`);
}

function findPackageDotJsonDir(dir)
{
    while (dir != "/") {
        if (path.join(dir, "package.json"))
            return dir;
        dir = path.dirname(dir);
    }
    return undefined;
}

if (args._.length !== 3) {
    usage(console.error.bind(console));
    process.exit(1);
}

const srcFile = path.resolve(args._[1]);

let srcRoot = args["src-root"];
if (!srcRoot) {
    srcRoot = findPackageDotJsonDir(srcFile ? path.dirname(srcFile) : process.cwd());
    if (!srcRoot) {
        console.error("Can't find --src-root");
        process.exit(1);
    }
}

class ImportModule
{
    constructor(filePath, from, to)
    {
        this.path = filePath;
        this.from = from;
        this.to = to;
        this.named = undefined;
        this.default = undefined;
    }
};

class File
{
    constructor(filePath)
    {
        this.path = filePath;
        this.imports = undefined;
        this.namedExports = undefined;
        this.defaultExport = undefined;
    }
};

class Export
{
    constructor(def, filePath)
    {
        this.default = def;
        this.filePath = filePath;
    }
};

let allExports = new Map();

function addExport(name, def, file)
{
    let cur = allExports.get(name);
    const exp = new Export(def, file);
    if (!cur) {
        allExports.set(name, [ exp ]);
    } else {
        cur.push(exp);
    }
}

function forwardSpaces(idx, src)
{
    while (idx < src.length) {
        switch (src.charCodeAt(idx)) {
        case 32:
        case 10:
        case 9:
            break;
        default:
            return idx;
        }
        ++idx;
    }
    return idx;
}

function backwardSpaces(idx, src)
{
    while (idx > 0) {
        switch (src.charCodeAt(idx)) {
        case 32:
        case 10:
        case 9:
            break;
        default:
            return idx;
        }
        --idx;
    }
    return idx;
}

function forwardNonSpaces(idx, src)
{
    while (idx < src.length) {
        switch (src.charCodeAt(idx)) {
        case 32:
        case 10:
        case 9:
            return idx;
        default:
            break;
        }
        ++idx;
    }
    return idx;
}

function backwardNonSpaces(idx, src)
{
    while (idx > 0) {
        switch (src.charCodeAt(idx)) {
        case 32:
        case 10:
        case 9:
            return idx;
        default:
            break;
        }
        --idx;
    }
    return idx;
}

function isSymbol(idx, src)
{
    const code = src.charCodeAt(idx);
    return ((code >= 49 && code <= 57)
            || code === 95
            || code === 36
            || (code >= 65 && code <= 90)
            || (code >= 97 && code <= 122));
}

function forwardSymbol(idx, src)
{
    while (idx < src.length) {
        const code = src.charCodeAt(idx);
        if ((code >= 49 && code <= 57)
            || code === 95
            || code === 36
            || (code >= 65 && code <= 90)
            || (code >= 97 && code <= 122)) {
            ++idx;
        } else {
            // if (code != 32) {
            //     console.log("stopping at", idx, src[idx]);
            // }
            break;
        }
    }
    return idx;
}


function parseFile(filePath, parseImports)
{
    const file = new File(filePath);
    const src = fs.readFileSync(filePath, "utf8");
    let commentStart = undefined;
    let idx = 0;
    while (idx<src.length) {
        // console.log("looking at", idx, src.length);
        switch (src[idx]) {
        case "e":
            if (!parseImports && idx === 0 || src[idx - 1] === "\n" && src.substr(idx + 1, 6) === "xport ") {
                let i = forwardSpaces(idx + 6, src);
                // const end = src.indexOf(" ",
                const def = (src.substr(i, 8) === "default ");
                // console.log("Found an export", idx, i, src[i], def);
                if (def) {
                    const based = path.basename(filePath);
                    file.defaultExport = based.substr(0, based.length - 3);
                    addExport(file.defaultExport, file);
                    idx = i + 8;
                    continue;
                }
                let next;
                let done = true;
                do {
                    done = true;
                    if (isSymbol(i, src)) {
                        next = forwardSymbol(i, src);;
                    } else {
                        next = forwardNonSpaces(i, src);
                    }
                    const thing = src.substring(i, next);
                    switch (thing) {
                    case "{":
                        if (!def) {
                            // need to parse the list of named exports
                            const endBrace = src.indexOf("}", i);
                            if (!file.namedExports)
                                file.namedExports = [];
                            src.substring(i + 1, endBrace).split(/, */).forEach(x => {
                                file.namedExports.push(x.trim());
                            });
                            // console.log("Got some exports", exports);
                            // console.error("This should have been defaulted", filePath, thing, i);
                            // process.exit(1);
                        }
                        break;
                    case "[":
                    case "\"":
                    case "'":
                    case "new":
                        console.error("This should have been defaulted", filePath, thing, i);
                        process.exit(1);
                        break;
                    case "const":
                    case "enum":
                    case "abstract":
                    case "interface":
                    case "class":
                    case "type":
                    case "function":
                        i = forwardSpaces(next, src);
                        done = false;
                        break;
                    default:
                        if (!file.namedExports) {
                            file.namedExports = [];
                        }
                        file.namedExports.push(thing);
                        // console.error("don't know what", thing, filePath, i);
                        break;
                    }
                } while (!done);
                idx = next;
                // console.log("setting idx", idx);
                continue;
            }
            break;
        case "i":
            if (parseImports && idx === 0 || src[idx - 1] === "\n" && src.substr(idx + 1, 6) === "mport ") {
                // console.log("shit", src.substr(idx + 1, 6));
                let quoteStart = src.indexOf("\"", idx);
                let quoteEnd = src.indexOf("\"", quoteStart + 1);
                if (quoteEnd === -1) {
                    idx = src.length;
                    break;
                }

                const file = src.substring(quoteStart + 1, quoteEnd);
                const from = src.lastIndexOf("from", quoteStart);
                let ch = src[from - 1];
                if (ch !== " " && ch !== "\n" && ch !== "\t") {
                    idx = quoteEnd;
                    continue;
                }

                ch = src[from + 4];
                if (ch !== " " && ch !== "\n" && ch !== "\t") {
                    idx = quoteEnd;
                    continue;
                }

                // import
                let imports = src.substring(idx + 7, from).trim();
                let def = true;
                if (imports[0] === "{") {
                    def = false;
                    if (imports[imports.length - 1] !== "}") {
                        idx = quoteEnd;
                        continue;
                    }
                    imports = imports.substring(1, imports.length - 2).split(",").map(x => x.trim());
                }
                console.log(`got ${def ? "default import": "imports"} ${typeof imports} [${imports}] from [${file}]`);
                // if (imports !=
                //     src[from + 4] !== " " && src[from - 1] !== "\n" && src[from - 1] !== "\t") {
                // }
                // console.log("
                // console.log("got import from", from); //quoteStart, quoteEnd, src.substring(quoteStart, quoteEnd));
                // let match = /import \(.*\) from "\([^"]*\)"/.exec(src.substr(idx));
                // console.log("Found import at", idx, src.substr(idx, src.indexOf("\n")));
                // console.log("Found import", match);
            }
            break;
        case "/":
            if (commentStart === undefined) {
                const ch = src[idx + 1];
                if (ch === "/") {
                    const endLine = src.indexOf("\n", idx);
                    if (endLine !== -1) {
                        idx = endLine + 1;
                        continue;
                    }
                } else if (ch === "*") {
                    commentStart = idx;
                    idx += 2;
                }
            }
            break;
        case "*":
            if (commentStart !== undefined && src[idx + 1] === "/") {
                commentStart = undefined;
            }
        }
        ++idx;
    }
    // console.log(file)
    if (file.defaultExport) {

    }
    return file;
}

function processDir(dir)
{
    fs.readdirSync(dir).forEach(f => {
        if (f.substr(-3) === ".ts") {
            const file = path.resolve(path.join(dir, f));
            if (file !== srcFile)
                parseFile(file, false);
        }
        // console.log(f.name, f.isDirectory());
    });
}

const parsed = parseFile(srcFile, true);
processDir(srcRoot);
