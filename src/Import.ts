export interface NamedImport {
    // the imported (exported) name, without `type` modifier or `as` alias
    name: string;
    // the original specifier text, e.g. "type Foo as Bar"
    text: string;
    // true for inline type modifiers: import { type Foo } from "..."
    isType: boolean;
}

export default class Import {
    path: string;
    start: number;
    end: number;
    named: string[];
    specifiers: NamedImport[];
    default?: string;
    // true for: import type ... from "..."
    typeOnly: boolean;
    constructor(filePath: string, start: number, end: number) {
        this.path = filePath;
        this.start = start;
        this.end = end;
        this.named = [];
        this.specifiers = [];
        this.typeOnly = false;
    }
}
