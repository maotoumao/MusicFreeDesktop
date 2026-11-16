export function normalizeTag(s: string): string {
    return (s ?? '')
        .toLowerCase()
        .replace(/[\s\-_、。．，．·•‐‑‒–—―…,.!?！？；;：:"'“”‘’（）()【】[\]{}<>《》・、]/g, '')
        .replace(/\u3000/g, '')
        .trim();
}

export function buildTagKey(
    title: string,
    artist: string,
    album: string,
    duration: number | undefined,
): string {
    const bucket = duration === undefined ? 'nodur' : String(Math.round(duration / 2));
    return [normalizeTag(title), normalizeTag(artist), normalizeTag(album), bucket].join('|');
}

export function fileBaseKey(filePath: string): string {
    const base = filePath.split(/[/\\]/).pop() ?? filePath;
    const noExt = base.replace(/\.[a-z0-9]{2,5}$/i, '');
    return normalizeTag(noExt);
}

export function decodeFingerprint(fp: number[] | string): number[] {
    if (Array.isArray(fp)) {
        return fp.filter((n) => Number.isFinite(n));
    }
    if (typeof fp === 'string' && !fp.trim()) return [];
    const out: number[] = [];
    const parts = fp.split(',');
    for (const p of parts) {
        const n = Number(p);
        if (Number.isFinite(n)) out.push(n);
    }
    return out;
}

export function hammingSimilarity(a: number[], b: number[], minSimilarity = 0): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;
    const total = n * 32;
    // 允许的最大失配位数：超过就已经不可能达标，直接返回（一定小于阈值）
    const allowedMismatches = Math.floor((1 - minSimilarity) * total);
    let mismatched = 0;
    for (let i = 0; i < n; i++) {
        let x = (a[i] ^ b[i]) >>> 0;
        // SWAR 并行计数 32 位中的 1，无分支循环
        x = x - ((x >>> 1) & 0x55555555);
        x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
        mismatched += (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
        if (mismatched > allowedMismatches) return (total - mismatched) / total;
    }
    return (total - mismatched) / total;
}

export function groupByKey(keys: string[]): Map<string, number[]> {
    const m = new Map<string, number[]>();
    keys.forEach((k, i) => {
        const arr = m.get(k);
        if (arr) arr.push(i);
        else m.set(k, [i]);
    });
    return m;
}

// 版本对判定：只用于恰好 2 首的组。返回原因 code（由调用方做 i18n），无则返回 null
// 覆盖：版本关键词（国语/粤语…）、中英文标题、疑似翻唱
export interface IVersionCheckItem {
    title: string;
    artist: string;
    localPath: string;
}

export type VersionReasonCode = 'keyword' | 'crosslang' | 'cover';

export interface VersionReason {
    code: VersionReasonCode;
    /** 仅 code === 'keyword' 时有值：命中的关键词原文 */
    keyword?: string;
}

const VERSION_KEYWORDS = [
    '国语',
    '粤语',
    '普通话',
    '國語',
    '粵語',
    'mandarin',
    'cantonese',
    '翻唱',
    'cover',
];

function baseNameOf(filePath: string): string {
    return filePath.split(/[/\\]/).pop() ?? filePath;
}

function hasCJK(text: string): boolean {
    return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

export function detectVersionReason(
    a: IVersionCheckItem,
    b: IVersionCheckItem,
): VersionReason | null {
    const lowered = [a.title, b.title, baseNameOf(a.localPath), baseNameOf(b.localPath)].map((s) =>
        (s ?? '').toLowerCase(),
    );
    for (const keyword of VERSION_KEYWORDS) {
        if (lowered.some((s) => s.includes(keyword))) return { code: 'keyword', keyword };
    }
    const titleA = a.title ?? '';
    const titleB = b.title ?? '';
    if (titleA && titleB && hasCJK(titleA) !== hasCJK(titleB)) return { code: 'crosslang' };
    const artistA = normalizeTag(a.artist);
    const artistB = normalizeTag(b.artist);
    const nameA = normalizeTag(titleA);
    const nameB = normalizeTag(titleB);
    if (!artistA || !artistB || !nameA || !nameB) return null;
    // 不同歌手但标题相同：疑似翻唱。同歌手不同标题不再自动判定
    // （文件名不同但内容一样的真重复太多，改由用户手动标记）
    if (artistA !== artistB && nameA === nameB) return { code: 'cover' };
    return null;
}

/** 手动版本标记的组签名：成员 key 排序后拼接，成员不变则稳定 */
export function buildVersionSignature(keys: string[]): string {
    return [...keys].sort().join('|');
}

export function groupBySimilarity(
    items: Array<{ index: number; fingerprint: number[]; duration: number }>,
    threshold: number,
): number[][] {
    const groups: number[][] = [];
    const used = new Set<number>();
    for (let i = 0; i < items.length; i++) {
        if (used.has(items[i].index)) continue;
        const g = [items[i].index];
        used.add(items[i].index);
        for (let j = i + 1; j < items.length; j++) {
            if (used.has(items[j].index)) continue;
            if (Math.abs(items[i].duration - items[j].duration) > 15) continue;
            const sim = hammingSimilarity(items[i].fingerprint, items[j].fingerprint, threshold);
            if (sim >= threshold) {
                g.push(items[j].index);
                used.add(items[j].index);
            }
        }
        if (g.length > 1) groups.push(g);
    }
    return groups;
}
