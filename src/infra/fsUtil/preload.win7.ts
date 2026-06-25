/**
 * fsUtil — Preload 层 (Win7 兼容版本)
 *
 * 直接使用 Node.js fs 模块，通过 contextBridge 暴露给渲染进程。
 * 不走 IPC —— preload 本身就有 Node.js 访问权限。
 *
 * 所有窗口共用此 preload。
 *
 * Win7 适配：Electron 22 无 webUtils API，使用 file.path 替代。
 * CI 构建 Win7 版本时，此文件会替换 preload.ts。
 */
import { contextBridge } from 'electron';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

// ─── 文件操作 ───

async function writeFile(
    path: string,
    data: string | Buffer,
    options?: { encoding?: BufferEncoding; flag?: string },
): Promise<void> {
    await fsp.writeFile(path, data, options);
}

async function readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    if (encoding) {
        return fsp.readFile(path, { encoding });
    }
    return fsp.readFile(path);
}

async function isFile(path: string): Promise<boolean> {
    try {
        const stat = await fsp.stat(path);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function isFolder(path: string): Promise<boolean> {
    try {
        const stat = await fsp.stat(path);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

async function rimraf(path: string): Promise<void> {
    await fsp.rm(path, { recursive: true, force: true });
}

function addFileScheme(filePath: string): string {
    return filePath.startsWith('file:') ? filePath : pathToFileURL(filePath).toString();
}

function fileUrlToPath(fileUrl: string): string {
    if (!fileUrl.startsWith('file:')) {
        throw new TypeError(`Expected a file: URL, got ${fileUrl}`);
    }
    return fileURLToPath(fileUrl);
}

function getPathForFile(file: File): string {
    // Electron 22 没有 webUtils，使用旧版 File.path 属性
    return (file as any).path;
}

function normalizePath(filePath: string): string {
    return path.normalize(filePath);
}

const pathSep = path.sep;

// ─── 暴露 API ───

const mod = {
    writeFile,
    readFile,
    isFile,
    isFolder,
    rimraf,
    addFileScheme,
    fileUrlToPath,
    getPathForFile,
    normalizePath,
    pathSep,
};

contextBridge.exposeInMainWorld(CONTEXT_BRIDGE_KEY, mod);
