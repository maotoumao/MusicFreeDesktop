import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { mainConfig } from './config/webpack.main.config';
import { rendererConfig } from './config/webpack.renderer.config';
import { preloadConfig } from './config/webpack.preload.config';

/**
 * webpack 不打包、运行时 require 的依赖（不能交给 externals 插件：它要解析 <包名>/package.json，被这些包的 exports 拒绝）。
 * platforms 为空表示所有平台都需要。
 */
const RUNTIME_PACKAGES: { name: string; platforms?: string[] }[] = [
    { name: 'taglib-wasm' },
    // 只有 Windows 的任务栏缩略图和原生托盘菜单用到
    { name: 'sharp', platforms: ['win32'] },
];

/** 按 Node 的 node_modules 查找顺序找包根目录，不经过 exports（部分包的 exports 不含 "." 或 package.json） */
function findPackageRoot(name: string, fromDir: string): string | null {
    for (let dir = fromDir; ; dir = path.dirname(dir)) {
        const candidate = path.join(dir, 'node_modules', name);
        if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
        if (path.dirname(dir) === dir) return null;
    }
}

/** 把依赖包及其运行时依赖复制到打包目录的 node_modules；可选依赖只复制当前平台已安装的 */
function copyPackageWithDeps(
    name: string,
    fromDir: string,
    nodeModulesDir: string,
    optional = false,
): void {
    const root = findPackageRoot(name, fromDir);
    if (!root) {
        if (optional) return;
        throw new Error(`Cannot find package ${name} from ${fromDir}`);
    }
    const {
        version,
        dependencies = {},
        optionalDependencies = {},
    } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const dest = path.join(nodeModulesDir, name);
    const destPackageJson = path.join(dest, 'package.json');
    if (fs.existsSync(destPackageJson)) {
        const existing = JSON.parse(fs.readFileSync(destPackageJson, 'utf8')).version;
        if (existing === version) return;
        throw new Error(
            `${name}@${existing} is already in the package, but ${version} is required`,
        );
    }
    // 打包器的过滤会留下不含文件的空目录
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(root, dest, { recursive: true, dereference: true });
    for (const dep of Object.keys(dependencies)) copyPackageWithDeps(dep, root, nodeModulesDir);
    for (const dep of Object.keys(optionalDependencies))
        copyPackageWithDeps(dep, root, nodeModulesDir, true);
}

const config: ForgeConfig = {
    packagerConfig: {
        asar: {
            unpack: '**/node_modules/{sharp,@img}/**/*',
        },
        appBundleId: 'fun.upup.musicfree',
        icon: path.resolve(__dirname, 'res/logo'),
        executableName: 'MusicFree',
        extraResource: [path.resolve(__dirname, 'res')],
        protocols: [
            {
                name: 'MusicFree',
                schemes: ['musicfree'],
            },
        ],
        // macOS：出现在音频文件的「打开方式」中，不成为默认打开程序
        extendInfo: {
            CFBundleDocumentTypes: [
                {
                    CFBundleTypeName: 'Audio',
                    CFBundleTypeRole: 'Viewer',
                    LSHandlerRank: 'Alternate',
                    LSItemContentTypes: ['public.audio'],
                },
            ],
        },
    },
    rebuildConfig: {},
    hooks: {
        packageAfterCopy: async (_forgeConfig, buildPath, _electronVersion, platform) => {
            const nodeModulesDir = path.join(buildPath, 'node_modules');
            fs.mkdirSync(nodeModulesDir, { recursive: true });
            for (const { name, platforms } of RUNTIME_PACKAGES) {
                if (platforms && !platforms.includes(platform)) continue;
                copyPackageWithDeps(name, __dirname, nodeModulesDir);
            }
        },
        /** better-sqlite3 自带全部平台的预编译二进制，只保留目标平台的（Linux 另留 musl 版） */
        packageAfterPrune: async (_forgeConfig, buildPath, _electronVersion, platform, arch) => {
            const dir = path.join(buildPath, 'node_modules', 'better-sqlite3', 'prebuilds');
            if (!fs.existsSync(dir)) return;
            const keep = new Set([`${platform}-${arch}.node`]);
            if (platform === 'linux') keep.add(`linuxmusl-${arch}.node`);
            for (const name of fs.readdirSync(dir)) {
                if (!keep.has(name)) fs.rmSync(path.join(dir, name));
            }
        },
        /**
         * macOS：fuses 插件在打包器写入应用 Info.plist 之前就做了 ad-hoc 签名，
         * 最终 .app 的签名因此失效，arm64 上下载后会被系统判定为「已损坏」。
         * 打包完成后重新 ad-hoc 签名；配置了正式签名（osxSign）时不处理。
         */
        postPackage: async (forgeConfig, { platform, outputPaths }) => {
            if (platform !== 'darwin' || forgeConfig.packagerConfig.osxSign) return;
            for (const dir of outputPaths) {
                for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.app'))) {
                    execFileSync('codesign', [
                        '--force',
                        '--deep',
                        '--sign',
                        '-',
                        path.join(dir, name),
                    ]);
                }
            }
        },
    },
    makers: [
        new MakerDMG({
            format: 'ULFO',
        }),
        new MakerDeb({
            options: {
                bin: 'MusicFree',
                mimeType: [
                    'x-scheme-handler/musicfree',
                    'audio/mpeg',
                    'audio/mp4',
                    'audio/flac',
                    'audio/x-flac',
                    'audio/wav',
                    'audio/x-wav',
                    'audio/ogg',
                    'audio/aac',
                    'audio/x-ms-wma',
                    'audio/x-ape',
                    'audio/opus',
                ],
            },
        }),
        new MakerRpm({
            options: {
                bin: 'MusicFree',
            },
        }),
    ],
    plugins: [
        new AutoUnpackNativesPlugin({}),
        new WebpackPlugin({
            devContentSecurityPolicy:
                "default-src * self blob: data: gap: file:; style-src * self 'unsafe-inline' blob: data: gap: file:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap: file:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap: file:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;",
            mainConfig,
            renderer: {
                config: rendererConfig,
                entryPoints: [
                    {
                        html: './src/documents/index.html',
                        js: './src/renderer/mainWindow/index.tsx',
                        name: 'main_window',
                        preload: {
                            js: './src/preload/main.ts',
                            config: preloadConfig,
                        },
                    },
                    {
                        html: './src/documents/index.html',
                        js: './src/renderer/lyricWindow/index.tsx',
                        name: 'lyric_window',
                        preload: {
                            js: './src/preload/auxiliary.ts',
                            config: preloadConfig,
                        },
                    },
                    {
                        html: './src/documents/index.html',
                        js: './src/renderer/minimodeWindow/index.tsx',
                        name: 'minimode_window',
                        preload: {
                            js: './src/preload/auxiliary.ts',
                            config: preloadConfig,
                        },
                    },
                ],
            },
        }),
        // Externals plugin must be after WebpackPlugin so that
        // packagerConfig.ignore is already set as a function
        {
            name: '@timfish/forge-externals-plugin',
            config: {
                externals: ['better-sqlite3'],
                includeDeps: true,
            },
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: false,
        }),
    ],
};

export default config;
