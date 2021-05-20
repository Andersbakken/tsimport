import { forwardNonSpaces, forwardSpaces, forwardSymbol, isSymbol, verbose } from "~/utils";
import File from "~/File";
import ImportModule from "~/ImportModule";
import Options from "~/Options";
import assert from "assert";
import fs from "fs";
import path from "path";

export const enum ParseFileMode {
    Imports,
    Exports
}

export function parseFile(filePath: string, mode: ParseFileMode, options: Options): File | undefined {
    let transformedPath: string;
    const srcRoot: string | undefined = options["src-root"];
    assert(srcRoot);
    if (mode === ParseFileMode.Exports && options.tilde && filePath.lastIndexOf(srcRoot, 0) === 0) {
        transformedPath = `~/${filePath.substr(srcRoot.length)}`;
        // console.log("Doing
    } else {
        transformedPath = filePath;
    }
    transformedPath = transformedPath.substr(0, transformedPath.length - 3); // take away the .ts
    let src;
    try {
        src = fs.readFileSync(filePath, "utf8");
    } catch (err) {
        verbose("Failed to read file", filePath, err);
        return undefined;
    }
    const file = new File(transformedPath, src);

    if (options.tilde === undefined && src.indexOf(' from "~/') !== -1) {
        options.tilde = true;
    }

    let commentStart = undefined;
    let idx = 0;
    verbose(`parsing file ${filePath} ${mode === ParseFileMode.Imports ? "imports" : "exports"}`);
    while (idx < src.length) {
        // console.log("looking at", idx, src.length);
        switch (src[idx]) {
            case "e":
                if (
                    mode === ParseFileMode.Exports &&
                    (idx === 0 || src[idx - 1] === "\n") &&
                    src.substr(idx + 1, 6) === "xport "
                ) {
                    let i = forwardSpaces(idx + 6, src);
                    // const end = src.indexOf(" ",
                    const def = src.substr(i, 8) === "default ";
                    verbose(
                        "Found an export in",
                        transformedPath,
                        idx,
                        i,
                        src[i],
                        def,
                        src.substring(idx, src.indexOf("\n", idx))
                    );
                    if (def) {
                        const based = path.basename(filePath);
                        file.defaultExport = based.substr(0, based.length - 3);
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
                                            file.namedExports.push(x.trim());
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
                                i = forwardSpaces(next, src);
                                done = false;
                                break;
                            default:
                                if (!def) {
                                    if (!file.namedExports) {
                                        file.namedExports = [];
                                    } else if (!file.namedExports.includes(thing)) {
                                        file.namedExports.push(thing);
                                    }
                                } else if (namedDefault) {
                                    if (file.defaultExport !== thing) {
                                        verbose(
                                            `Rewriting export name from "${file.defaultExport}" to "${thing}" for ${file.path}`
                                        );
                                    }
                                    file.defaultExport = thing;
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
                    mode === ParseFileMode.Imports &&
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
                    const imp = new ImportModule(fileName, idx, end);
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
                    const imports = src.substring(idx + 7, from).trim();
                    if (imports[0] === "{") {
                        if (imports[imports.length - 1] !== "}") {
                            idx = quoteEnd;
                            continue;
                        }
                        imp.named = imports
                            .substring(1, imports.length - 2)
                            .split(",")
                            .map((x) => {
                                return x.trim();
                            });
                        // console.log(importArray);
                    } else {
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
    return file;
}
