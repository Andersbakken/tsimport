import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import jscc from "rollup-plugin-jscc";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

const output = "dist/tsimport.js";
const input = "src/tsimport.ts";

const plugins = [
    resolve({
        preferBuiltins: false
    }),
    commonjs(),
    replace({}),
    jscc({
        values: {}
    }),
    typescript({
        tsconfig: `tsconfig.json`,
        cacheRoot: ".cache"
    }),
    babel({
        exclude: "node_modules/**",
        babelrc: false,
        inputSourceMap: true,
        sourceMaps: true,
        babelHelpers: "bundled",
        extensions: [".js", ".ts"],
        presets: [
            [
                "@babel/preset-env",
                {
                    loose: true,
                    targets: {
                        safari: "6"
                    },
                    modules: false,
                    useBuiltIns: "entry",
                    corejs: 3,
                    exclude: ["@babel/plugin-transform-async-to-generator", "@babel/plugin-transform-regenerator"]
                }
            ]
        ]
    })
];

// Define forms
const format = "cjs";
const external = [];

export default [
    {
        input,
        plugins,
        external,
        output: {
            file: output,
            format,
            name: "milo",
            exports: "named",
            sourcemap: true
        }
    }
];
