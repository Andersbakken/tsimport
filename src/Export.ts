export default class Export {
    readonly default: boolean;
    readonly filePath: string;
    constructor(def: boolean, filePath: string) {
        this.default = def;
        this.filePath = filePath;
    }
}
