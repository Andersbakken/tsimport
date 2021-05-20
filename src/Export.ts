export default class Export {
    name: string;
    default: boolean;
    path: string;
    line: number;
    constructor(name: string, path: string, line: number, def?: boolean) {
        this.name = name;
        this.default = def || false;
        this.path = path;
        this.line = line;
    }
}
