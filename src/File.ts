export default class File {
    path: string;
    imports?: string[];
    namedExports?: string[];
    defaultExport?: string;
    constructor(filePath: string) {
        this.path = filePath;
    }
}
