import ImportModule from "~/ImportModule";

export default class File {
    path: string;
    imports?: ImportModule[];
    namedExports?: string[];
    defaultExport?: string;
    sourceCode: string;
    constructor(filePath: string, src: string) {
        this.path = filePath;
        this.sourceCode = src;
    }
}
