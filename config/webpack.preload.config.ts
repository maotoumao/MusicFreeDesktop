import type { Configuration } from 'webpack';
import { rendererConfig } from './webpack.renderer.config';

// Node.js built-in modules that preload scripts can access (sandbox: false)
const nodeBuiltins = [
    'assert',
    'buffer',
    'child_process',
    'cluster',
    'constants',
    'crypto',
    'dgram',
    'dns',
    'domain',
    'fs',
    'fs/promises',
    'http',
    'https',
    'module',
    'net',
    'os',
    'path',
    'punycode',
    'querystring',
    'readline',
    'stream',
    'string_decoder',
    'tls',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'worker_threads',
    'zlib',
];

export const preloadConfig: Configuration = {
    ...rendererConfig,
    externals: [
        // Preserve Node.js built-in requires as-is (not bundled by webpack)
        function ({ request }, callback) {
            if (request && nodeBuiltins.includes(request)) {
                return callback(null, `commonjs2 ${request}`);
            }
            callback();
        },
    ],
};
