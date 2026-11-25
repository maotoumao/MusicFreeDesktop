/**
 * localMusic — 增量扫描引擎
 *
 * 职责：
 * - 递归发现音频文件 + stat
 * - 与 DB 已有记录做增量 diff（mtime + file_size）
 */

import fsp from 'fs/promises';
import path from 'path';
import type { IFileInfo, IDiffResult, IDiscoverResult } from '@appTypes/infra/localMusic';
import { SUPPORTED_AUDIO_EXTS } from '@common/constant';

/**
 * 检查路径是否应被排除。
 * 当前路径等于排除路径，或是排除路径的子路径时返回 true。
 * 调用方应传入已预处理的 normalizedExcluded。
 */
function isExcluded(dir: string, normalizedExcluded: string[]): boolean {
    if (normalizedExcluded.length === 0) return false;
    const normalized = path.normalize(dir).toLowerCase();
    return normalizedExcluded.some((ep) => {
        return normalized === ep || normalized.startsWith(ep + path.sep);
    });
}

/**
 * 递归发现所有音频文件 + stat。
 * 异步 I/O，不阻塞事件循环。
 * 读取失败的目录记入 unreadableDirs，diff 时据此保留其下的已有记录。
 */
export async function discoverAudioFiles(
    dir: string,
    excludedPaths: string[],
): Promise<IDiscoverResult> {
    const normalizedExcluded = excludedPaths.map((ep) => path.normalize(ep).toLowerCase());
    const result: IDiscoverResult = { files: [], unreadableDirs: [] };
    await discoverRecursive(dir, normalizedExcluded, result);
    return result;
}

async function discoverRecursive(
    dir: string,
    normalizedExcluded: string[],
    result: IDiscoverResult,
): Promise<void> {
    let entries;
    try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
        result.unreadableDirs.push(dir);
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (isExcluded(fullPath, normalizedExcluded)) continue;
            await discoverRecursive(fullPath, normalizedExcluded, result);
        } else if (SUPPORTED_AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) {
            try {
                const stat = await fsp.stat(fullPath);
                result.files.push({
                    filePath: fullPath,
                    size: stat.size,
                    mtime: stat.mtimeMs,
                });
            } catch {
                /* 跳过不可访问的文件 */
            }
        }
    }
}

/**
 * 将磁盘文件列表与 DB 已有记录做增量 diff。
 *
 * - added:     磁盘有，DB 无
 * - changed:   磁盘有，DB 有，但 mtime 或 size 不同
 * - removed:   DB 有，磁盘无（位于读取失败目录下的记录除外：无法确认文件已删除）
 * - unchanged: 都有且 mtime + size 一致
 */
export function diffWithDb(
    diskFiles: IFileInfo[],
    dbRows: Array<{
        file_path: string;
        file_size: number | null;
        file_mtime: number | null;
    }>,
    unreadableDirs: string[] = [],
): IDiffResult {
    const dbMap = new Map(dbRows.map((r) => [r.file_path, r]));
    const diskSet = new Set(diskFiles.map((f) => f.filePath));

    const added: IFileInfo[] = [];
    const changed: IFileInfo[] = [];
    let unchanged = 0;

    for (const file of diskFiles) {
        const existing = dbMap.get(file.filePath);
        if (!existing) {
            added.push(file);
        } else if (
            existing.file_size !== file.size ||
            existing.file_mtime !== Math.floor(file.mtime)
        ) {
            changed.push(file);
        } else {
            unchanged++;
        }
    }

    const isUnderUnreadableDir = (filePath: string) =>
        unreadableDirs.some((dir) => filePath.startsWith(dir + path.sep));
    const removed = dbRows
        .filter((r) => !diskSet.has(r.file_path) && !isUnderUnreadableDir(r.file_path))
        .map((r) => r.file_path);

    return { added, changed, removed, unchanged };
}
