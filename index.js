#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

const args = require("minimist")(process.argv.slice(1));


function findPackageDotJsonDir(dir)
{
    while (dir != "/") {
        if (path.join(dir, "package.json"))
            return dir;
        dir = path.dirname(dir);
    }
    return undefined;
}


// console.log(args);

const file = args["file"];
let srcRoot = args["src-root"];
if (!srcRoot) {
    srcRoot = findPackageDotJsonDir(file ? path.dirname(file) : process.cwd());
    if (!srcRoot) {
        console.error("Can't find --src-root");
        process.exit(1);
    }
}

function blank(str, from, to)
{
    return str.substr(0, from) + " ".repeat(to - from) + str.substr(to);
}

class Import
{
    constructor()
    {
        this.default = undefined;
        this.multi = undefined;
    }

    addMulti(str)
    {
        if (!this.multi) {
            this.multi = [];
        }
        this.multi.push(str);
        this.multi.sort();
    }

    addDefault(str)
    {
        if (this.default) {
            throw new Error("Already have a default");
        }
        this.default = str;
    }
};

const existing = {};
if (file) {
    const src = fs.readFileSync(file, "utf8");
    let commentStart = undefined;
    let idx = 0;
    while (idx<src.length) {
        switch (src[idx]) {
        case "e":
            if (idx === 0 || src[idx - 1] === "\n" && src.substr(idx + 1, 6) === "mport ") {

            }
            break;
        case "i":
            if (idx === 0 || src[idx - 1] === "\n" && src.substr(idx + 1, 6) === "mport ") {
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
                if (imports[0] === "{") {
                    if (imports[imports.length - 1] !== "}") {
                        idx = quoteEnd;
                        continue;
                    }
                    imports = imports.substring(1, imports.length - 2).split(",").map(x => x.trim());
                }
                console.log(`got imports ${typeof imports} [${imports}] from [${file}]`);
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
                    const endLine = src.indexOf("\n");
                    if (endLine !== -1) {
                        // src = blank(src, idx, endLine);
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
                // src = blank(src, commentStart, idx + 2);
                commentStart = undefined;
            }
        }
        ++idx;
    }

    // console.log(src);
}
