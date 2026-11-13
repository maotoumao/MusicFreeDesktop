/**
 * DuplicateMusicModal — 会话级状态（jotai）
 *
 * 结果 / 勾选 / 进度常驻内存：关弹窗不丢，随软件退出释放。
 * 扫描任务本身由调用方的 async 闭包驱动，store 只负责状态同步。
 */
import { atom, getDefaultStore } from 'jotai';
import type { DuplicateGroup, ScanMode, SimilarityLevel } from './scan';

export interface FingerprintScanProgress {
    done: number;
    total: number;
    mode: ScanMode;
    phase: 'compute' | 'compare';
}

const store = getDefaultStore();

/** 结果缓存：key=模式（音频带阈值） */
export const groupsByKeyAtom = atom<Record<string, DuplicateGroup[]>>({});
/** 勾选缓存：与结果同 key，存 item key 数组 */
export const checkedByKeyAtom = atom<Record<string, string[]>>({});
/** 进行中的扫描：key->进度 */
export const scanningAtom = atom<Record<string, FingerprintScanProgress>>({});
/** 上次停留的 tab：确认/取消返回时恢复 */
export const uiAtom = atom<{ mode: ScanMode; level: SimilarityLevel }>({
    mode: 'audio',
    level: 'standard',
});

export function setScanProgress(key: string, prog: FingerprintScanProgress | null): void {
    const prev = store.get(scanningAtom);
    if (prog) store.set(scanningAtom, { ...prev, [key]: prog });
    else {
        const next = { ...prev };
        delete next[key];
        store.set(scanningAtom, next);
    }
}

export function setScanGroups(key: string, groups: DuplicateGroup[]): void {
    const prev = store.get(groupsByKeyAtom);
    store.set(groupsByKeyAtom, { ...prev, [key]: groups });
}

export function setScanChecked(key: string, keys: string[]): void {
    const prev = store.get(checkedByKeyAtom);
    store.set(checkedByKeyAtom, { ...prev, [key]: keys });
}

/** 清空全部结果与勾选（指纹重算/清库后调用，结果已失效） */
export function clearScanResults(): void {
    store.set(groupsByKeyAtom, {});
    store.set(checkedByKeyAtom, {});
}

/** 找到正在跑的音频任务（单槽，最多一个），供忙提示与按钮状态使用 */
export function findAudioRun(): { key: string; prog: FingerprintScanProgress } | null {
    const scanning = store.get(scanningAtom);
    const key = Object.keys(scanning).find((k) => k.startsWith('audio'));
    return key ? { key, prog: scanning[key] } : null;
}

/** 有了新结果但用户没在看的 tab：红点提示待查看，看过即清 */
export const unseenTabsAtom = atom<ScanMode[]>([]);

export function markTabUnseen(mode: ScanMode): void {
    const prev = store.get(unseenTabsAtom);
    if (!prev.includes(mode)) store.set(unseenTabsAtom, [...prev, mode]);
}

export function clearTabUnseen(mode: ScanMode): void {
    const prev = store.get(unseenTabsAtom);
    if (prev.includes(mode)) store.set(unseenTabsAtom, prev.filter((m) => m !== mode));
}

export function getScanUi(): { mode: ScanMode; level: SimilarityLevel } {
    return store.get(uiAtom);
}

/** 被用户取消的扫描 key：只停掉排队与落盘 */
const cancelledScanKeys = new Set<string>();

export function cancelScan(key: string): void {
    cancelledScanKeys.add(key);
}

export function isScanCancelled(key: string): boolean {
    return cancelledScanKeys.has(key);
}

export function clearScanCancelled(key: string): void {
    cancelledScanKeys.delete(key);
}
