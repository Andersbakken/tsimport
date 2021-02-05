export default class Export {
    readonly default: boolean;
    readonly path: string;
    constructor(def: boolean, path: string) {
        this.default = def;
        this.path = path;
    }
}
