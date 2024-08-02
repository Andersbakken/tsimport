export default class Import {
    path: string;
    start: number;
    end: number;
    named: string[];
    default?: string;
    constructor(filePath: string, start: number, end: number) {
        this.path = filePath;
        if (this.path.endsWith("/index.ts")) {
            this.path = this.path.substring(0, this.path.length - 9);
        }

        this.start = start;
        this.end = end;
        this.named = [];
    }
}
