import type { Configuration } from "webpack";
import path from "path";

import { rules } from "./webpack.rules";

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: {
    index: "./src/main/index.ts",
  },
  // Put your normal webpack config below here
  module: {
    rules,
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json", '.node'],
    alias: {
      "@": path.join(__dirname, "../src"),
      "@main": path.join(__dirname, "../src/main"),
      "@native": path.join(__dirname, "../src/main/native_modules"),
      "@shared": path.join(__dirname, "../src/shared")
    },
  },
  output: {
    filename: "[name].js",
  },
  externals: ['sharp']
};
