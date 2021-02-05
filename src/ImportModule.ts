export default class ImportModule {
    path: string;
    start: number;
    end: number;
    named: string[];
    default?: string;
    constructor(filePath: string, start: number, end: number) {
        this.path = filePath;
        this.start = start;
        this.end = end;
        this.named = [];
    }
}
