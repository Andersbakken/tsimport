export default class ImportModule {
    path: string;
    from: number;
    to: number;
    named: string[];
    default?: string;
    constructor(filePath: string, from: number, to: number) {
        this.path = filePath;
        this.from = from;
        this.to = to;
        this.named = [];
    }
}
