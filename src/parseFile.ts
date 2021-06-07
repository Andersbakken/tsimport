import { forwardNonSpaces, forwardSpaces, forwardSymbol, isSymbol, verbose } from "~/utils";
import Export from "~/Export";
import File from "~/File";
import Import from "~/Import";
import Options from "~/Options";
import assert from "assert";
import fs from "fs";
import path from "path";

export const enum ParseFileMode {
    Imports = 0x1,
    Exports = 0x2
}

function has(name: string, exports: Export[]): boolean {
    for (const exp of exports) {
        if (exp.name === name) {
            return true;
        }
    }
    return false;
}

export function parseFile(filePath: string, mode: ParseFileMode, options: Options): File | undefined {
    const srcRoot: string | undefined = options["src-root"];
    assert(srcRoot);
    let src;
    try {
        src = fs.readFileSync(filePath, "utf8");
    } catch (err) {
        verbose("Failed to read file", filePath, err);
        return undefined;
    }

    if (options.tilde === undefined && src.indexOf(' from "~/') !== -1) {
        options.tilde = true;
    }

    const file = new File(filePath, src);

    let commentStart = undefined;
    let idx = 0;
    verbose(
        `parsing file ${filePath} ${
            mode === ParseFileMode.Imports ? "imports" : mode === ParseFileMode.Exports ? "exports" : "import/exports"
        }`
    );
    let line = 1;
    while (idx < src.length) {
        // console.log("looking at", idx, src.length);
        switch (src[idx]) {
            case "e":
                if (
                    mode & ParseFileMode.Exports &&
                    (idx === 0 || src[idx - 1] === "\n") &&
                    src.substr(idx + 1, 6) === "xport "
                ) {
                    let i = forwardSpaces(idx + 6, src);
                    // const end = src.indexOf(" ",
                    const def = src.substr(i, 8) === "default ";
                    verbose(
                        "Found an export in",
                        filePath,
                        idx,
                        i,
                        src[i],
                        def,
                        src.substring(idx, src.indexOf("\n", idx))
                    );
                    if (def) {
                        const based = path.basename(filePath);
                        file.defaultExport = new Export(based.substr(0, based.length - 3), filePath, line, true);
                        verbose(`Adding default export ${file.defaultExport.name} for ${filePath}:${line}`);
                        assert(file.defaultExport, "Gotta have it");
                        idx = i + 8;
                    }
                    let next;
                    let done = true;
                    let namedDefault = false;
                    do {
                        done = true;
                        if (isSymbol(i, src)) {
                            next = forwardSymbol(i, src);
                        } else {
                            next = forwardNonSpaces(i, src);
                        }
                        const thing = src.substring(i, next);
                        // console.log(thing);
                        switch (thing) {
                            case "{":
                                if (!def) {
                                    // need to parse the list of named exports
                                    const endBrace = src.indexOf("}", i);
                                    if (!file.namedExports) {
                                        file.namedExports = [];
                                    }
                                    src.substring(i + 1, endBrace)
                                        .split(/, */)
                                        .forEach((x) => {
                                            assert(file.namedExports);
                                            const trimmed = x.trim();
                                            if (!has(trimmed, file.namedExports)) {
                                                file.namedExports.push(new Export(trimmed, filePath, line));
                                                verbose(`Adding named export ${trimmed} for ${filePath}:${line}`);
                                            }
                                        });
                                    verbose("Got some exports", filePath, file.namedExports);
                                    // console.error("This should have been defaulted", filePath, thing, i);
                                    // process.exit(1);
                                }
                                break;
                            case "[":
                            case '"':
                            case "'":
                            case "new":
                                if (!def) {
                                    console.error("This should have been defaulted", filePath, thing, i);
                                }
                                idx = next;
                                continue;
                            // process.exit(1);
                            case "enum":
                            case "type":
                            case "function":
                            case "interface":
                            case "class":
                                // for these cases we have a better idea of the desired name of the export so we let them override
                                namedDefault = true;
                            case "const":
                            case "abstract":
                            case "default":
                            case "async":
                                i = forwardSpaces(next, src);
                                done = false;
                                break;
                            default:
                                if (!def) {
                                    if (!file.namedExports) {
                                        file.namedExports = [];
                                    }

                                    if (!has(thing, file.namedExports)) {
                                        file.namedExports.push(new Export(thing, filePath, line));
                                        verbose(`Adding named export ${thing} for ${filePath}:${line}`);
                                    }
                                } else if (namedDefault) {
                                    if (file.defaultExport && file.defaultExport.name !== thing) {
                                        verbose(
                                            `Rewriting export name from "${file.defaultExport}" to "${thing}" for ${file.path}`
                                        );
                                        file.defaultExport.name = thing;
                                    }
                                }
                                break;
                        }
                    } while (!done);
                    idx = next;
                    // console.log("setting idx", idx);
                    continue;
                }
                break;
            case "i":
                // console.log(parseImports, idx === 0 || src[idx - 1] === "\n", src.substr(idx + 1, 6));
                if (
                    mode & ParseFileMode.Imports &&
                    (idx === 0 || src[idx - 1] === "\n") &&
                    src.substr(idx + 1, 6) === "mport "
                ) {
                    // verbose("Found import");
                    // console.log("shit", src.substr(idx + 1, 6));
                    const quoteStart = src.indexOf('"', idx);
                    const quoteEnd = src.indexOf('"', quoteStart + 1);
                    if (quoteEnd === -1) {
                        idx = src.length;
                        break;
                    }

                    const fileName = src.substring(quoteStart + 1, quoteEnd);
                    const end = src[quoteEnd + 1] === ";" ? quoteEnd + 1 : quoteEnd;
                    if (options.tilde === undefined && fileName.lastIndexOf("~/", 0) === 0) {
                        options.tilde = true;
                    }
                    const imp = new Import(fileName, idx, end);
                    if (!file.imports) {
                        file.imports = [];
                    }
                    file.imports.push(imp);
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
                        imp.named = imports
                            .substring(1, imports.length - 2)
                            .split(",")
                            .map((x) => {
                                const asIdx = x.indexOf(" as ");
                                if (asIdx !== -1) {
                                    x = x.substring(0, asIdx);
                                }
                                return x.trim();
                            });
                        verbose(`Adding named imports: ${imp.named} for ${filePath} from ${fileName}`);
                        // console.log(importArray);
                    } else {
                        const asIdx = imports.indexOf(" as ");
                        if (asIdx !== -1) {
                            imports = imports.substring(0, asIdx);
                        }
                        imports = imports.trim();
                        verbose(`Adding default import: ${imports} for ${filePath} from ${fileName}`);
                        imp.default = imports;
                    }
                    // if (imports !=
                    //     src[from + 4] !== " " && src[from - 1] !== "\n" && src[from - 1] !== "\t") {
                    // }
                    // console.log("
                    // console.log("got import from", from); //quoteStart, quoteEnd, src.substring(quoteStart, quoteEnd));
                    // let match = /import \(.*\) from "\([^"]*\)"/.exec(src.substr(idx));
                    // console.log("Found import at", idx, src.substr(idx, src.indexOf("\n")));
                    // console.log("Found import", match);
                    idx = quoteEnd + 1;
                }
                break;
            case "/":
                if (commentStart === undefined) {
                    const ch = src[idx + 1];
                    if (ch === "/") {
                        const endLine = src.indexOf("\n", idx);
                        if (endLine !== -1) {
                            idx = endLine + 1;
                            ++line;
                            continue;
                        }
                    } else if (ch === "*") {
                        commentStart = idx;
                        idx += 2;
                    }
                }
                break;
            case '"':
            case "'":
            case "`": {
                const quote = src[idx];
                let slashes = 0;
                for (let i = idx + 1; i < src.length; ++i) {
                    const ch = src[i];
                    if (ch === "\\") {
                        ++slashes;
                    } else {
                        if (slashes % 2 === 0 && ch === quote) {
                            //console.log(`Skipped range ${src.substring(idx, i + 1)}`);
                            idx = i;
                            break;
                        } else if (ch === "\n") {
                            ++line;
                        }
                        slashes = 0;
                    }
                }
                break;
            }
            case "*":
                if (commentStart !== undefined && src[idx + 1] === "/") {
                    commentStart = undefined;
                }
                break;
            case "\n":
                ++line;
                break;
        }
        ++idx;
    }
    return file;
}
