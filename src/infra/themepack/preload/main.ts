/**
 * themepack — 主窗口 Preload 层
 *
 * 核心逻辑层：文件 I/O、DOM 操作（CSS / iframe / blurHash）、安装卸载。
 * 通过 contextBridge 暴露 API 给 renderer 层。
 *
 * 同步阶段（preload 脚本加载时立即执行）：
 *  - 从 localStorage 读取缓存
 *  - 同步注入 <style>（CSS 首帧立即生效）
 *  - 有 iframe 主题时渲染 blurHash 占位层
 *
 * 异步阶段（由 renderer setup() 触发）：
 *  - 校验缓存有效性、重载 CSS / iframe
 *  - 主题安装 / 卸载 / 远程下载
 */
import path from 'path';
import fsp from 'fs/promises';
import { createWriteStream } from 'fs';
import crypto from 'crypto';
import { contextBridge, ipcRenderer } from 'electron';
import yauzl from 'yauzl';
import { nanoid } from 'nanoid';

import type { IThemePack, IThemePackConfig, IThemePackCache } from '@appTypes/infra/themepack';
import {
    THEMEPACK_STORAGE_KEY,
    THEMEPACK_STYLE_NODE_ID,
    THEMEPACK_BLURHASH_NODE_ID,
    THEMEPACK_IFRAME_NODE_ID,
    THEMEPACK_DIR_NAME,
    BUILTIN_THEME_DIR_NAME,
    IPC,
    CONTEXT_BRIDGE_KEY,
} from '../common/constant';

// ─── 路径 ───

const themePackBasePath: string = path.resolve(
    globalThis.globalContext.appPath.userData,
    THEMEPACK_DIR_NAME,
);

/** 内置主题包资源目录（位于 app 资源目录下，随应用打包分发） */
const builtinThemeBasePath: string = path.resolve(
    globalThis.globalContext.appPath.res,
    BUILTIN_THEME_DIR_NAME,
);

// ─── 安全工具 ───

/**
 * 校验路径是否为 parentDir 的子路径（白名单校验）。
 */
function isSubPath(targetPath: string, parentDir: string): boolean {
    const normalizedBase = path.normalize(parentDir) + path.sep;
    const normalizedTarget = path.normalize(targetPath);
    return normalizedTarget.startsWith(normalizedBase);
}

/**
 * 校验 IThemePack.path 是否在允许的目录下。
 * 包括用户安装目录和内置主题目录。
 */
function validateThemePackPath(themePackPath: string): boolean {
    return (
        isSubPath(themePackPath, themePackBasePath) ||
        isSubPath(themePackPath, builtinThemeBasePath)
    );
}

/**
 * 安全地解析 `@/` 别名到主题包目录下的绝对路径。
 * 如果解析后路径不在 basePath 之下，返回 null（防止路径逃逸）。
 */
function resolveThemePath(rawPath: string, basePath: string): string | null {
    const relative = rawPath.replace(/^@\//, '');
    const resolved = path.resolve(basePath, relative);
    if (!isSubPath(resolved, basePath)) {
        return null;
    }
    return path.normalize(resolved);
}

/**
 * 安全地替换 CSS 中 url() 和 HTML 中 src/href 属性里的 `@/` 别名。
 *
 * 仅在已知的资源引用上下文中替换，并对每个路径做 isSubPath 校验，
 * 防止 `url(@/../../../etc/passwd)` 这样的路径遍历攻击。
 */
function replaceAlias(rawText: string, basePath: string): string {
    // 匹配 CSS url(@/...)、CSS @import "@/..."、HTML src="@/..." / href="@/..."
    const pattern =
        /(?:url\(\s*['"]?)(@\/[^)'"\s]*)(?:['"]?\s*\))|(?:(?:src|href)\s*=\s*['"])(@\/[^'"]*)['"]/gi;
    const importPattern = /@import\s+['"](@\/[^'"]*)['"];?/gi;

    const replaceMatch = (match: string, ...groups: (string | undefined)[]) => {
        const rawPath = groups.find((g) => g !== undefined) ?? '';
        const resolved = resolveThemePath(rawPath, basePath);
        if (!resolved) {
            // 路径遍历，不替换（保留原文，资源加载将失败）
            return match;
        }
        const fileUrl = `file:///${resolved.replace(/\\/g, '/')}`;
        return match.replace(rawPath, fileUrl);
    };

    return rawText.replace(pattern, replaceMatch).replace(importPattern, replaceMatch);
}

// ─── 文件工具 ───

let baseDirEnsured = false;

/** 确保主题包安装目录存在（仅首次调用执行实际检查） */
async function ensureBaseDir(): Promise<void> {
    if (baseDirEnsured) return;
    try {
        const stat = await fsp.stat(themePackBasePath);
        if (!stat.isDirectory()) {
            await fsp.rm(themePackBasePath, { recursive: true, force: true });
            await fsp.mkdir(themePackBasePath, { recursive: true });
        }
    } catch {
        await fsp.mkdir(themePackBasePath, { recursive: true });
    }
    baseDirEnsured = true;
}

/** 计算文本内容的 MD5 hash */
function md5(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 解压 zip 文件到目标目录。
 * 使用 yauzl 的 lazyEntries 模式逐条处理，控制内存用量。
 */
function extractZip(zipPath: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) {
                reject(err ?? new Error('Failed to open zip'));
                return;
            }

            let pending = 0;
            let ended = false;

            function checkDone() {
                if (ended && pending === 0) {
                    resolve();
                }
            }

            zipfile.on('error', reject);

            zipfile.on('entry', (entry: yauzl.Entry) => {
                const entryPath = path.resolve(targetDir, entry.fileName);

                // 安全检查：防止 zip slip 攻击
                if (
                    !entryPath.startsWith(path.resolve(targetDir) + path.sep) &&
                    entryPath !== path.resolve(targetDir)
                ) {
                    zipfile.readEntry();
                    return;
                }

                if (/\/$/.test(entry.fileName)) {
                    // 目录条目
                    fsp.mkdir(entryPath, { recursive: true })
                        .then(() => zipfile.readEntry())
                        .catch(reject);
                } else {
                    // 文件条目 — 确保父目录存在
                    pending++;
                    fsp.mkdir(path.dirname(entryPath), { recursive: true })
                        .then(() => {
                            zipfile.openReadStream(entry, (streamErr, readStream) => {
                                if (streamErr || !readStream) {
                                    reject(streamErr ?? new Error('Failed to open read stream'));
                                    return;
                                }

                                const writeStream = createWriteStream(entryPath);
                                readStream.pipe(writeStream);

                                writeStream.on('finish', () => {
                                    pending--;
                                    checkDone();
                                });
                                writeStream.on('error', reject);
                                readStream.on('error', reject);

                                zipfile.readEntry();
                            });
                        })
                        .catch(reject);
                }
            });

            zipfile.on('end', () => {
                ended = true;
                checkDone();
            });

            zipfile.readEntry();
        });
    });
}

/**
 * 解析一个主题包目录，返回 IThemePack 或 null（无效包）。
 */
async function parseThemePack(themePackPath: string, builtin = false): Promise<IThemePack | null> {
    try {
        if (!themePackPath) return null;

        const configPath = path.resolve(themePackPath, 'config.json');
        const rawConfig = await fsp.readFile(configPath, 'utf-8');
        const config: IThemePackConfig = JSON.parse(rawConfig);

        if (!config.name) {
            return null;
        }

        const hash = md5(rawConfig);

        // 处理 preview 路径（可能是 @/ 路径或 # 颜色值）
        let preview = config.preview;
        if (preview && !preview.startsWith('#')) {
            const resolved = resolveThemePath(preview, themePackPath);
            preview = resolved ? `file:///${resolved.replace(/\\/g, '/')}` : undefined;
        }

        // 处理 thumb 路径
        let thumb = config.thumb;
        if (thumb) {
            const resolved = resolveThemePath(thumb, themePackPath);
            thumb = resolved ? `file:///${resolved.replace(/\\/g, '/')}` : undefined;
        }

        return {
            ...config,
            preview,
            thumb,
            path: themePackPath,
            hash,
            ...(builtin ? { builtin: true } : {}),
        };
    } catch {
        return null;
    }
}

/**
 * 读取主题包的 CSS 内容。如果 index.css 不存在则返回空字符串。
 * 校验路径合法性，拒绝非安装目录下的路径。
 */
async function readThemeCss(themePackPath: string): Promise<string> {
    if (!validateThemePackPath(themePackPath)) return '';
    try {
        const cssPath = path.resolve(themePackPath, 'index.css');
        const raw = await fsp.readFile(cssPath, 'utf-8');
        return replaceAlias(raw, themePackPath);
    } catch {
        return '';
    }
}

// ─── DOM 操作 ───

/**
 * 在 preload 同步阶段，document.head / document.body 可能尚未就绪。
 * 此辅助函数会在目标父元素可用时立即执行回调，否则延迟到 DOMContentLoaded。
 */
function whenParentReady(
    getParent: () => HTMLElement | null,
    callback: (parent: HTMLElement) => void,
): void {
    const parent = getParent();
    if (parent) {
        callback(parent);
    } else {
        document.addEventListener(
            'DOMContentLoaded',
            () => {
                const p = getParent();
                if (p) callback(p);
            },
            { once: true },
        );
    }
}

/** 注入或更新 <style> 节点 */
function injectCss(css: string): void {
    let styleNode = document.getElementById(THEMEPACK_STYLE_NODE_ID) as HTMLStyleElement | null;
    if (!styleNode) {
        styleNode = document.createElement('style');
        styleNode.id = THEMEPACK_STYLE_NODE_ID;
        whenParentReady(
            () => document.head,
            (head) => head.appendChild(styleNode!),
        );
    }
    styleNode.textContent = css;
}

/** 移除 <style> 节点 */
function removeCss(): void {
    document.getElementById(THEMEPACK_STYLE_NODE_ID)?.remove();
}

/** 渲染 blurHash 到全屏 <canvas> 占位层 */
function renderBlurHash(blurHashStr: string): void {
    // 防止重复创建
    document.getElementById(THEMEPACK_BLURHASH_NODE_ID)?.remove();

    const container = document.createElement('div');
    container.id = THEMEPACK_BLURHASH_NODE_ID;
    container.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100vw',
        'height: 100vh',
        'z-index: 0',
        'pointer-events: none',
        'transition: opacity 0.3s ease-out',
    ].join(';');
    whenParentReady(
        () => document.body,
        (body) => body.prepend(container),
    );

    // 异步解码并渲染（通常在 < 5ms 内完成）
    import('blurhash')
        .then(({ decode }) => {
            const width = 32;
            const height = 32;
            try {
                const pixels = decode(blurHashStr, width, height);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.style.cssText = 'width:100%;height:100%;';
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
                    ctx.putImageData(imageData, 0, 0);
                    container.appendChild(canvas);
                }
            } catch {
                // blurHash 无效，忽略
            }
        })
        .catch(() => {
            // blurhash 模块加载失败，忽略
        });
}

/** 淡出并移除 blurHash 占位层 */
function removeBlurHash(): void {
    const el = document.getElementById(THEMEPACK_BLURHASH_NODE_ID);
    if (!el) return;
    // 移除 ID 防止重复调用时再次处理同一元素
    el.removeAttribute('id');
    el.style.opacity = '0';
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // 兜底：如果 transition 没触发（display:none 等情况），400ms 后强制移除
    setTimeout(() => el.remove(), 400);
}

/** 移除背景 iframe */
function destroyIframe(): void {
    document.getElementById(THEMEPACK_IFRAME_NODE_ID)?.remove();
}

/**
 * 创建背景 iframe。
 * 本地 HTML 使用 srcdoc 加载，远程 URL 使用 src。
 * iframe onload 后淡出 blurHash。
 */
async function applyIframe(themePack: IThemePack): Promise<void> {
    destroyIframe();

    if (!themePack.iframe?.app) return;

    const iframeSource = themePack.iframe.app;
    const iframe = document.createElement('iframe');
    iframe.id = THEMEPACK_IFRAME_NODE_ID;
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    // sandbox: 允许脚本执行（动画）但限制同源访问，防止主题包访问父窗口 API
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('allow', 'autoplay; fullscreen'); // 允许自动播放和全屏（如果主题需要）
    iframe.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'border: none',
        'z-index: 0',
        'pointer-events: none',
        'opacity: 0',
        'transition: opacity 0.3s ease-in',
    ].join(';');

    iframe.onload = () => {
        iframe.style.opacity = '1';
        removeBlurHash();
    };

    if (iframeSource.startsWith('http://') || iframeSource.startsWith('https://')) {
        iframe.src = iframeSource;
    } else {
        // 本地文件路径 — 安全解析后读取并注入
        const htmlPath = resolveThemePath(iframeSource, themePack.path);
        if (htmlPath) {
            const rawHtml = await fsp.readFile(htmlPath, 'utf-8');
            iframe.srcdoc = replaceAlias(rawHtml, themePack.path);
        }
    }

    document.body.prepend(iframe);
}

// ─── 缓存 ───

function readCache(): IThemePackCache | null {
    try {
        const raw = localStorage.getItem(THEMEPACK_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as IThemePackCache;
    } catch {
        return null;
    }
}

function writeCache(themePack: IThemePack, css: string): void {
    const cache: IThemePackCache = {
        path: themePack.path,
        hash: themePack.hash,
        css,
        blurHash: themePack.iframe?.app ? (themePack.blurHash ?? null) : null,
        hasIframe: !!themePack.iframe?.app,
    };
    try {
        localStorage.setItem(THEMEPACK_STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // localStorage 已满或不可用，忽略
    }
}

function clearCache(): void {
    localStorage.removeItem(THEMEPACK_STORAGE_KEY);
}

// ─── 同步阶段（preload 加载时立即执行） ───

const cachedTheme = readCache();
if (cachedTheme) {
    // 立即注入 CSS — 首帧即生效
    if (cachedTheme.css) {
        injectCss(cachedTheme.css);
    }
    // 有 iframe + blurHash → 渲染占位层
    if (cachedTheme.hasIframe && cachedTheme.blurHash) {
        renderBlurHash(cachedTheme.blurHash);
    }
}

// ─── 异步 API ───

/**
 * 初始化当前主题。
 * 校验缓存有效性，如果原始数据与缓存不一致则重新加载。
 * 返回当前主题包元数据（或 null 表示无主题）。
 */
async function initCurrentTheme(): Promise<IThemePack | null> {
    const cache = readCache();
    if (!cache) {
        // 无缓存 → 无主题
        removeCss();
        return null;
    }

    // 校验主题包目录仍然存在
    const isBuiltin = isSubPath(cache.path, builtinThemeBasePath);
    const themePack = await parseThemePack(cache.path, isBuiltin);
    if (!themePack) {
        // 主题包已被删除或损坏 → 清除一切
        removeCss();
        removeBlurHash();
        clearCache();
        return null;
    }

    // 校验 hash 是否一致（防止主题包被外部修改）
    if (themePack.hash !== cache.hash) {
        // 数据不一致 → 重新加载 CSS 和缓存
        const css = await readThemeCss(themePack.path);
        injectCss(css);
        writeCache(themePack, css);

        // blurHash 可能也变了 → 先移除旧的，再按需重新渲染
        removeBlurHash();
        if (themePack.iframe?.app && themePack.blurHash) {
            renderBlurHash(themePack.blurHash);
        }
    }

    // 加载 iframe（如有）
    if (themePack.iframe?.app) {
        await applyIframe(themePack);
    } else {
        // 无 iframe → 移除可能残留的 blurHash
        removeBlurHash();
    }

    return themePack;
}

/**
 * 切换主题。
 * 传入 null 清除当前主题。
 */
async function selectTheme(themePack: IThemePack | null): Promise<void> {
    // 清除旧的 iframe 和 blurHash
    destroyIframe();
    removeBlurHash();

    if (!themePack) {
        removeCss();
        clearCache();
        ipcRenderer.send(IPC.THEME_SWITCHED);
        return;
    }

    // 安全检查：确保路径在安装目录下
    if (!validateThemePackPath(themePack.path)) {
        throw new Error('Invalid theme pack path');
    }

    // 读取并注入 CSS
    const css = await readThemeCss(themePack.path);
    injectCss(css);

    // 写入缓存
    writeCache(themePack, css);

    // 如果有 iframe → 先渲染 blurHash 占位，再加载 iframe
    if (themePack.iframe?.app) {
        if (themePack.blurHash) {
            renderBlurHash(themePack.blurHash);
        }
        await applyIframe(themePack);
        // 如果没有 blurHash 但有 iframe，iframe onload 不会调 removeBlurHash（也没有东西要移除）
    }

    // 通知其他窗口
    ipcRenderer.send(IPC.THEME_SWITCHED);
}

/** 加载内置主题包元数据 */
async function loadBuiltinThemePacks(): Promise<IThemePack[]> {
    try {
        const dirNames = await fsp.readdir(builtinThemeBasePath);
        const parsed = await Promise.all(
            dirNames.map((dir) => parseThemePack(path.resolve(builtinThemeBasePath, dir), true)),
        );
        return parsed.filter((tp): tp is IThemePack => tp !== null);
    } catch {
        // 内置主题目录不存在（开发环境等），忽略
        return [];
    }
}

/** 加载所有已安装主题包的元数据（内置 + 用户安装，并行解析） */
async function loadAllThemePacks(): Promise<IThemePack[]> {
    await ensureBaseDir();

    const [builtinPacks, userDirNames] = await Promise.all([
        loadBuiltinThemePacks(),
        fsp.readdir(themePackBasePath),
    ]);

    const userPacks = await Promise.all(
        userDirNames.map((dir) => parseThemePack(path.resolve(themePackBasePath, dir))),
    );

    // 内置主题排在前面，用户安装的排在后面
    return [...builtinPacks, ...userPacks.filter((tp): tp is IThemePack => tp !== null)];
}

/**
 * 安装本地 .mftheme 文件（zip 格式）。
 * 解压到主题包安装目录，校验 config.json 有效性。
 */
async function installThemePack(mfthemePath: string): Promise<IThemePack | null> {
    let targetDir: string | undefined;
    try {
        await ensureBaseDir();

        targetDir = path.resolve(themePackBasePath, nanoid(12));

        await extractZip(mfthemePath, targetDir);

        const themePack = await parseThemePack(targetDir);
        if (!themePack) {
            // 无效的主题包 → 清理
            await fsp.rm(targetDir, { recursive: true, force: true });
            return null;
        }

        return themePack;
    } catch {
        // 解压失败等情况，清理已创建的目录
        if (targetDir) {
            await fsp.rm(targetDir, { recursive: true, force: true }).catch(() => {});
        }
        return null;
    }
}

/**
 * 下载并安装远程 .mftheme 文件。
 * 限制最大下载大小为 50MB，防止恶意 URL 导致内存耗尽。
 */
async function installRemoteThemePack(remoteUrl: string): Promise<IThemePack | null> {
    const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50 MB
    const tempFilePath = path.resolve(globalThis.globalContext.appPath.temp, `${nanoid()}.mftheme`);

    try {
        const resp = await fetch(remoteUrl);
        if (!resp.ok || !resp.body) {
            throw new Error(`Download failed: ${resp.status}`);
        }

        // 将 ReadableStream 写入临时文件
        const reader = resp.body.getReader();
        const chunks: Buffer[] = [];
        let totalSize = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            totalSize += value.byteLength;
            if (totalSize > MAX_DOWNLOAD_SIZE) {
                await reader.cancel();
                throw new Error('Theme pack exceeds maximum download size');
            }
            chunks.push(Buffer.from(value));
        }
        await fsp.writeFile(tempFilePath, Buffer.concat(chunks));

        // 安装
        const themePack = await installThemePack(tempFilePath);
        return themePack;
    } catch {
        return null;
    } finally {
        // 清理临时文件
        await fsp.rm(tempFilePath, { force: true }).catch(() => {});
    }
}

/** 卸载主题包（删除整个目录） */
async function uninstallThemePack(themePack: IThemePack): Promise<void> {
    // 内置主题不可卸载
    if (themePack.builtin) {
        throw new Error('Cannot uninstall builtin theme');
    }
    // 安全检查：确保路径在用户安装目录下（不允许删除内置主题目录）
    if (!isSubPath(themePack.path, themePackBasePath)) {
        throw new Error('Invalid theme pack path');
    }
    await fsp.rm(themePack.path, { recursive: true, force: true });
}

// ─── 暴露 API ───

const mod = {
    initCurrentTheme,
    selectTheme,
    loadAllThemePacks,
    installThemePack,
    installRemoteThemePack,
    uninstallThemePack,
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
