import type { Configuration } from "webpack";
import path from "path";
import CopyWebpackPlugin from 'copy-webpack-plugin';

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

rules.push(
  {
    test: /\.css$/,
    use: [{ loader: "style-loader" }, { loader: "css-loader" }],
  },
  {
    test: /\.scss$/,
    use: [
      { loader: "style-loader" },
      { loader: "css-loader" },
      { loader: "sass-loader" },
    ],
  },
  {
    test: /\.(woff|woff2|eot|ttf|otf)$/i,
    type: "asset/resource",
  },
  {
    test: /\.(png|jpg|jpeg|gif)$/i,
    type: "asset/resource",
  },
  {
    test: /\.svg$/,
    use: [
      {
        loader: "@svgr/webpack",
        options: {
          prettier: false,
          svgo: false,
          svgoConfig: {
            plugins: [{ removeViewBox: false }],
          },
          titleProp: true,
          ref: true,
        },
      },
    ],
  }
);

const rendererPlugins = [
  ...plugins,
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve(__dirname, '../res/ffmpeg/814.ffmpeg.js'),
        to: 'main_window/814.ffmpeg.js',
      },
    ],
  }),
];

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: rendererPlugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".scss"],
    alias: {
      "@": path.join(__dirname, "../src"),
      "@renderer": path.join(__dirname, "../src/renderer"),
      "@renderer-lrc": path.join(__dirname, "../src/renderer-lrc"),
      "@shared": path.join(__dirname, "../src/shared")
    },
  },
  externals: process.platform !== "darwin" ? ["fsevents"] : undefined,
};
