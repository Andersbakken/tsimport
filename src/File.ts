import ImportModule from "~/ImportModule";

export default class File {
    path: string;
    imports?: ImportModule[];
    namedExports?: string[];
    defaultExport?: string;
    constructor(filePath: string) {
        this.path = filePath;
    }
}
