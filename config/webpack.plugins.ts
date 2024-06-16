import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const relocateLoader = require("@vercel/webpack-asset-relocator-loader");

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
  }),
  {
    apply(compiler: any) {
      compiler.hooks.compilation.tap(
        "webpack-asset-relocator-loader",
        (compilation: any) => {
          relocateLoader.initAssetCache(compilation, "native_modules");
        }
      );
    },
  },
];
