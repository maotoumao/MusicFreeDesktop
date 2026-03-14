/**
 * fsUtil 暴露给 renderer 的文件系统 API 接口契约
 */
export interface IFsUtilMod {
    writeFile(
        path: string,
        data: string | Buffer,
        options?: { encoding?: BufferEncoding; flag?: string },
    ): Promise<void>;

    readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;

    isFile(path: string): Promise<boolean>;

    isFolder(path: string): Promise<boolean>;

    rimraf(path: string): Promise<void>;

    addFileScheme(filePath: string): string;

    fileUrlToPath(fileUrl: string): string;

    getPathForFile(file: File): string;

    normalizePath(filePath: string): string;

    pathSep: string;
}
