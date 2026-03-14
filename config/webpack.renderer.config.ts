import type { Configuration } from 'webpack';
import path from 'path';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

const rendererRules = [...rules];

rendererRules.push({
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

rendererRules.push({
    test: /\.s[ac]ss$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'sass-loader' }],
});

rendererRules.push({
    test: /\.(png|jpe?g|gif|webp|ico)$/i,
    type: 'asset/resource',
});

export const rendererConfig: Configuration = {
    module: {
        rules: rendererRules,
    },
    plugins,
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.sass'],
        alias: {
            '@renderer': path.join(__dirname, '../src/renderer'),
            '@assets': path.join(__dirname, '../src/assets'),
            '@common': path.join(__dirname, '../src/common'),
            '@infra': path.join(__dirname, '../src/infra'),
            '@appTypes': path.join(__dirname, '../src/types'),
        },
    },
};
