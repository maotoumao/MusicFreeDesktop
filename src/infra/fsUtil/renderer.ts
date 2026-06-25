/**
 * fsUtil — 渲染进程层
 *
 * 提供类型安全的文件系统操作 API。
 * 底层由 preload 直接使用 Node.js fs 实现（不走 IPC）。
 */
import type { IFsUtilMod } from '@appTypes/infra/fsUtil';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IFsUtilMod;

class FsUtilRenderer {
    /**
     * 写入文件。
     * @param path 文件路径
     * @param data 文件内容
     * @param options 可选编码和标志
     */
    public writeFile(
        path: string,
        data: string | Buffer,
        options?: { encoding?: BufferEncoding; flag?: string },
    ): Promise<void> {
        return mod.writeFile(path, data, options);
    }

    /**
     * 读取文件。
     * @param path 文件路径
     * @param encoding 指定编码时返回 string，否则返回 Buffer
     */
    public readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
        return mod.readFile(path, encoding);
    }

    /**
     * 判断路径是否为文件。
     * 路径不存在时返回 false。
     */
    public isFile(path: string): Promise<boolean> {
        return mod.isFile(path);
    }

    /**
     * 判断路径是否为文件夹。
     * 路径不存在时返回 false。
     */
    public isFolder(path: string): Promise<boolean> {
        return mod.isFolder(path);
    }

    /**
     * 递归删除文件或文件夹。
     */
    public rimraf(path: string): Promise<void> {
        return mod.rimraf(path);
    }

    /**
     * 为本地路径添加 `file://` 协议前缀。
     * 如果已有 `file:` 前缀则原样返回。
     */
    public addFileScheme(filePath: string): string {
        return mod.addFileScheme(filePath);
    }

    /**
     * 将 `file://` URL 转换为本地文件系统路径。
     * 与 `addFileScheme` 互为逆操作。
     * @throws {TypeError} 当传入的不是 `file:` 协议的 URL 时抛出
     */
    public fileUrlToPath(fileUrl: string): string {
        return mod.fileUrlToPath(fileUrl);
    }

    /**
     * 获取 DOM File 对象对应的本地文件系统路径。
     */
    public getPathForFile(file: File): string {
        return mod.getPathForFile(file);
    }

    /**
     * 规范化文件路径（解析 `.`、`..`、多余分隔符等）。
     */
    public normalizePath(filePath: string): string {
        return mod.normalizePath(filePath);
    }

    /**
     * 当前平台的路径分隔符（Windows: `\\`，macOS/Linux: `/`）。
     */
    public get pathSep(): string {
        return mod.pathSep;
    }
}

const fsUtil = new FsUtilRenderer();
export default fsUtil;
