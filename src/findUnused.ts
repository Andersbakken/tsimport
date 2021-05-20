import { ParseFileMode, parseFile } from "~/parseFile";
import { fixFileNames, verbose } from "~/utils";
import File from "~/File.ts";
import ImportModule from "~/ImportModule";
import Options from "~/Options";

export default function findUnused(options: Options, fileNames: string[]): boolean {
    verbose("findUnused called", options, fileNames);
    // console.log(parsed);
    const exports = new Set<string>();
    const imports: ImportModule[] = [];
    const files: File[] = [];
    fileNames.forEach((f: string) => {
        const p: File | undefined = parseFile(f, ParseFileMode.Imports | ParseFileMode.Exports, options);
        if (p) {
            files.push(p);
        }
    });
    fixFileNames(options, files);
    files.forEach((p: File) => {
        if (p.namedExports) {
            p.namedExports.forEach((name: string) => {
                exports.add(`${p.path}:${name}`);
                verbose(`Adding named ${p.path}:${name}`);
            });
        }
        if (p.defaultExport) {
            exports.add(`${p.path}:${p.defaultExport}:d`);
            verbose(`Adding default ${p.path}:${p.defaultExport}:d`);
        }

        if (p.imports) {
            imports.push(...p.imports);
        }
    });
    // console.log(exports, imports);
    imports.forEach((imp: ImportModule) => {
        imp.named.forEach((name: string) => {
            const removed = exports.delete(`${imp.path}:${name}`);
            verbose(`Removing named ${imp.path}:${name} -> ${removed}`);
        });
        if (imp.default) {
            const removed = exports.delete(`${imp.path}:${imp.default}:d`);
            verbose(`Removing default ${imp.path}:${imp.default}:d -> ${removed}`);
        }
    });

    if (!exports.size) {
        console.log("Didn't find any unimported exports");
        return false;
    }
    for (const key of exports) {
        const split = key.split(":");
        let path = split[0];
        if (path.startsWith("~/")) {
            path = options["src-root"] + path.substr(2);
        }
        // console.log(key, split);
        console.log(`${path}.ts:1:1 warning: ${split[2] ? "Default" : "Named"} export ${split[1]} is never imported`);
        // console.log(`${split[2] ? "Default" : "Named"} export "${split[1]}" from ${split[0]} is never imported`);
    }
    return true;
}
