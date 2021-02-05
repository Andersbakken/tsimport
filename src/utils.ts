import path from "path";

type Printer = (...args: unknown[]) => void;

export function usage(print: Printer): void {
    print(`tsimport /path/to/file symbol [--src-root <root>]`);
}

export function findPackageDotJsonDir(dir: string): string | undefined {
    while (dir !== "/") {
        if (path.join(dir, "package.json")) {
            return dir;
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
