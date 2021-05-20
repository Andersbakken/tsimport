import Export from "~/Export";
import Import from "~/Import";

export default class File {
    path: string;
    imports?: Import[];
    namedExports?: Export[];
    defaultExport?: Export;
    sourceCode: string;

    constructor(filePath: string, src: string) {
        this.path = filePath;
        this.sourceCode = src;
    }
}
