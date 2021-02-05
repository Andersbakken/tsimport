import Options from "~/Options";
import assert from "assert";
import fs from "fs";
import path from "path";

type Printer = (...args: unknown[]) => void;

export function usage(print: Printer): void {
    print(`tsimport [/path/to/file] [symbol] [--src-root <root>] [--use-tilde] [--verbose]
tsimport --complete [sym]`);
}

export function findPackageDotJsonDir(dir: string): string | undefined {
    while (dir !== "/") {
        try {
            if (fs.statSync(path.join(dir, "package.json")).isFile()) {
                return dir;
            }
        } catch (err) {
            /* */
        }
        dir = path.dirname(dir);
    }
    return undefined;
}

export function forwardSpaces(idx: number, src: string): number {
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

export function backwardSpaces(idx: number, src: string): number {
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

export function forwardNonSpaces(idx: number, src: string): number {
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

export function backwardNonSpaces(idx: number, src: string): number {
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

export function isSymbol(idx: number, src: string): boolean {
    const code = src.charCodeAt(idx);
    return (
        (code >= 49 && code <= 57) ||
        code === 95 ||
        code === 36 ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122)
    );
}

export function forwardSymbol(idx: number, src: string): number {
    while (idx < src.length) {
        const code = src.charCodeAt(idx);
        if (
            (code >= 49 && code <= 57) ||
            code === 95 ||
            code === 36 ||
            (code >= 65 && code <= 90) ||
            (code >= 97 && code <= 122)
        ) {
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

function findSharedRoot(a: string, b: string): number {
    let ret = 0;
    while (ret < a.length && ret < b.length && a[ret] === b[ret]) {
        ++ret;
    }
    return ret;
}

export function findCommonRoot(strings: string[]): string {
    assert(strings.length > 0);
    if (strings.length === 1) {
        return strings[0];
    }
    let shared = strings[0].length;
    for (let idx = 1; idx < strings.length; ++idx) {
        shared = Math.min(shared, findSharedRoot(strings[0], strings[idx]));
    }
    // console.log("Got root", strings[0].substr(0, shared), strings);
    return strings[0].substr(0, shared);
}

let v = false;
export function loadConfig(options: Options, root: string): Options {
    try {
        const opts = JSON.parse(fs.readFileSync(path.join(root, "tsimport.json"), "utf8"));
        if (options.tilde === undefined && typeof opts.tilde === "boolean") {
            options.tilde = opts.useTilde;
        }
        if (options["src-root"] === undefined && typeof opts["src-root"] === "string") {
            options["src-root"] = opts["src-root"];
            options.explicitSrcRoot = true;
        }
        if (options.verbose === undefined && typeof opts.verbose === "boolean") {
            options.verbose = opts.verbose;
        }
    } catch (err) {
        /* */
    }
    v = options.verbose || false;
    if (!options["src-root"]) {
        options["src-root"] = root;
    }
    if (options["src-root"][options["src-root"].length - 1] !== "/") {
        options["src-root"] += "/";
    }

    return options;
}

export function verbose(...args: unknown[]): void {
    if (v) {
        console.error(...args);
    }
}
