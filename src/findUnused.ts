import { ParseFileMode, parseFile } from "~/parseFile";
import { verbose } from "~/utils";
import File from "~/File";
import ImportModule from "~/ImportModule";
import Options from "~/Options";

export default function findUnused(options: Options, files: string[]): void {
    verbose("findUnused called", options, files);
    // console.log(parsed);
    const exports = new Set<string>();
    const imports: ImportModule[] = [];
    files.forEach((f: string) => {
        const p: File | undefined = parseFile(f, ParseFileMode.Imports | ParseFileMode.Exports, options);
        if (p) {
            if (p.namedExports) {
                p.namedExports.forEach((name: string) => {
                    exports.add(`${p.path}:${name}`);
                });
            }
            if (p.defaultExport) {
                exports.add(`${p.path}:${p.defaultExport}:d`);
            }

            if (p.imports) {
                imports.push(...p.imports);
            }
        }
    });
    // console.log(exports, imports);
    imports.forEach((imp: ImportModule) => {
        imp.named.forEach((name: string) => {
            exports.delete(`${imp.path}:${name}:`);
        });
        if (imp.default) {
            exports.delete(`${imp.path}:${imp.default}:d`);
        }
    });

    if (!exports.size) {
        console.log("Didn't find any unimported exports");
    } else {
        for (const key of exports) {
            const split = key.split(":");
            console.log(`${split[2] ? "Default" : "Named"} export "${split[1]}" from ${split[0]} is never imported`);
        }
    }
}
