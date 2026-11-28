import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import webpack from 'webpack';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new webpack.DefinePlugin({
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  }),
];
