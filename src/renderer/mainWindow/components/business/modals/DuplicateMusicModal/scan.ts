/**
 * DuplicateMusicModal — 扫描编排（模式调度 + 并发 + 取消）
 *
 * 四种模式：
 *  - audio    音纹相似：fpcalc 指纹 + Hamming 相似度 + 时长容差
 *  - exact    完全相同：文件 MD5
 *  - tag      相同标签：归一化标题 + 歌手 + 专辑 + 时长分桶
 *  - filename 相同文件名：去扩展名归一化
 */
import PQueue from 'p-queue';
import {
    buildTagKey,
    decodeFingerprint,
    fileBaseKey,
    groupByKey,
    groupBySimilarity,
} from '@infra/audioFingerprint/common/fingerprint';
import audioFingerprint from '@infra/audioFingerprint/renderer';

export type ScanMode = 'audio' | 'exact' | 'tag' | 'filename';
export type SimilarityLevel = 'strict' | 'standard' | 'loose';

/** 相似度阈值：严格 0.95 / 标准 0.88 / 宽松 0.80 */
export const THRESHOLDS: Record<SimilarityLevel, number> = {
    strict: 0.95,
    standard: 0.88,
    loose: 0.8,
};

export interface ScanItem {
    key: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    localPath: string;
    size?: number;
}

export interface DuplicateGroup {
    ids: string[];
    items: ScanItem[];
}

export interface ScanStats {
    hit: number;
    computed: number;
    skipped: number;
}

const emptyStats = (): ScanStats => ({ hit: 0, computed: 0, skipped: 0 });

/** 本地库条目转扫描条目：没有本地路径的（在线歌曲）直接丢弃 */
export function toScanItems(items: IMusic.IMusicItem[]): ScanItem[] {
    const out: ScanItem[] = [];
    for (const item of items) {
        const rec = item as unknown as Record<string, unknown>;
        if (typeof rec.localPath !== 'string') continue;
        const fileSize = rec.fileSize;
        out.push({
            key: `${item.platform}+${item.id}`,
            title: item.title,
            artist: item.artist,
            album: item.album,
            duration: item.duration,
            localPath: rec.localPath,
            size: typeof fileSize === 'number' ? fileSize : undefined,
        });
    }
    return out;
}

export async function runDuplicateScan(
    items: ScanItem[],
    mode: ScanMode,
    threshold: number,
    onProgress: (done: number, total: number) => void,
    shouldCancel: () => boolean,
): Promise<{
    groups: DuplicateGroup[];
    skipped: Array<{ path: string; message: string }>;
    stats: ScanStats;
}> {
    const skipped: Array<{ path: string; message: string }> = [];
    if (mode === 'tag') {
        const keys = items.map((it) =>
            buildTagKey(it.title, it.artist, it.album ?? '', it.duration),
        );
        return { groups: toGroups(items, groupByKey(keys)), skipped, stats: emptyStats() };
    }
    if (mode === 'filename') {
        const keys = items.map((it) => fileBaseKey(it.localPath));
        return { groups: toGroups(items, groupByKey(keys)), skipped, stats: emptyStats() };
    }
    if (mode === 'exact') {
        const queue = new PQueue({ concurrency: 4 });
        const hashes = new Array<string>(items.length).fill('');
        let done = 0;
        await Promise.all(
            items.map((it, i) =>
                queue.add(async () => {
                    if (shouldCancel()) return;
                    const r = await audioFingerprint.getFileHash(it.localPath);
                    if (r.status === 'success') hashes[i] = r.hash;
                    else skipped.push({ path: it.localPath, message: r.message });
                    done += 1;
                    onProgress(done, items.length);
                }),
            ),
        );
        if (shouldCancel()) return { groups: [], skipped, stats: emptyStats() };
        const keyed = hashes.map((h, i) => (h ? `hash:${h}` : `uniq:${i}`));
        return { groups: toGroups(items, groupByKey(keyed)), skipped, stats: emptyStats() };
    }

    // audio：指纹相似
    const stats = emptyStats();
    const queue = new PQueue({ concurrency: 4 });
    const decoded: Array<number[] | null> = new Array(items.length).fill(null);
    const durations = items.map((it) => it.duration ?? 0);
    let done = 0;
    await Promise.all(
        items.map((it, i) =>
            queue.add(async () => {
                if (shouldCancel()) return;
                const r = await audioFingerprint.calculateFingerprint(it.localPath);
                if (r.status === 'success') {
                    if (r.cached) stats.hit += 1;
                    else stats.computed += 1;
                    decoded[i] = decodeFingerprint(r.fingerprint);
                    if (!items[i].duration) durations[i] = r.duration;
                    // 库里没时长就用 fpcalc 回填，供结果行展示
                    if (items[i].duration === undefined)
                        items[i] = { ...items[i], duration: r.duration };
                } else {
                    stats.skipped += 1;
                    skipped.push({ path: it.localPath, message: r.message });
                }
                done += 1;
                onProgress(done, items.length);
            }),
        ),
    );
    if (shouldCancel()) return { groups: [], skipped, stats };
    const valid = items
        .map((it, i) => ({ index: i, fingerprint: decoded[i], duration: durations[i] }))
        .filter((x) => x.fingerprint !== null) as Array<{
        index: number;
        fingerprint: number[];
        duration: number;
    }>;
    const idxGroups = groupBySimilarity(valid, threshold);
    return {
        groups: idxGroups.map((idxs) => ({
            ids: idxs.map((k) => items[k].key),
            items: idxs.map((k) => items[k]),
        })),
        skipped,
        stats,
    };
}

function toGroups(items: ScanItem[], m: Map<string, number[]>): DuplicateGroup[] {
    const out: DuplicateGroup[] = [];
    m.forEach((idxs) => {
        if (idxs.length > 1) {
            out.push({ ids: idxs.map((k) => items[k].key), items: idxs.map((k) => items[k]) });
        }
    });
    return out;
}
