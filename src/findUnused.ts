import { ParseFileMode, parseFile } from "~/parseFile";
import { fixFileNames, verbose } from "~/utils";
import Export from "~/Export";
import File from "~/File";
import ImportModule from "~/ImportModule";
import Options from "~/Options";

export default function findUnused(options: Options, fileNames: string[]): boolean {
    verbose("findUnused called", options, fileNames);
    // console.log(parsed);
    const exports = new Map<string, Export>();
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
            p.namedExports.forEach((exp: Export) => {
                exports.set(`${exp.path}:${exp.name}`, exp);
                verbose(`Adding named ${exp.path}:${exp.name}`);
            });
        }
        if (p.defaultExport) {
            exports.set(`${p.path}:${p.defaultExport.name}:d`, p.defaultExport);
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
    for (const [key, value] of exports) {
        const split = key.split(":");
        let path = split[0];
        if (path.startsWith("~/")) {
            path = options["src-root"] + path.substr(2);
        }
        // console.log(key, split);
        console.log(
            `${path}.ts:${value.line}: warning: ${split[2] ? "Default" : "Named"} export ${split[1]} is never imported`
        );
        // console.log(`${split[2] ? "Default" : "Named"} export "${split[1]}" from ${split[0]} is never imported`);
    }
    return true;
}
