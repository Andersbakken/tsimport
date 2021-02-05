import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import resolve from "@rollup/plugin-node-resolve";

const plugins = [
    resolve({
        preferBuiltins: false
    }),
    commonjs(),
    typescript({
        tsconfig: `tsconfig.json`,
        cacheRoot: ".cache",
        include: ["src/*"]
    })
    // babel({
    //     exclude: "node_modules/**",
    //     babelrc: false,
    //     inputSourceMap: true,
    //     sourceMaps: true,
    //     babelHelpers: "bundled",
    //     extensions: [".js", ".ts"],
    //     presets: [
    //         [
    //             "@babel/preset-env",
    //             {
    //                 loose: true,
    //                 targets: {
    //                     safari: "6"
    //                 },
    //                 modules: false,
    //                 useBuiltIns: "entry",
    //                 corejs: 3,
    //                 exclude: ["@babel/plugin-transform-async-to-generator", "@babel/plugin-transform-regenerator"]
    //             }
    //         ]
    //     ],
    //     plugins: [
    //         ...(remove ? ["./scripts/babel-plugin-remove"] : []),
    //         ["babel-plugin-transform-async-to-promises", { hoist: true }]
    //     ]
    // }),
    // ...(debug ? [] : [terser()])
];

// Define forms
const format = "iife";

export default [
    {
        input: "src/index.ts",
        output: {
            file: "dist/tsimport.js",
            format: "iife",
            name: "tsimport",
            exports: "named",
            sourcemap: true
        }
    }
];
