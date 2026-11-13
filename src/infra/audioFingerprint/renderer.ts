/**
 * audioFingerprint — Renderer 层
 *
 * 职责：封装 Preload Bridge，提供类型安全的 API。
 */
import { CONTEXT_BRIDGE_KEY } from './common/constant';

type CalcResult =
    | { status: 'success'; fingerprint: number[]; duration: number; cached: boolean }
    | { status: 'error'; message: string };

// ─── Preload Bridge ───

interface IMod {
    checkBinary(): Promise<{ ok: boolean; path: string; error?: string }>;
    calculateFingerprint(filePath: string): Promise<CalcResult>;
    fileHash(
        filePath: string,
    ): Promise<{ status: 'success'; hash: string } | { status: 'error'; message: string }>;
    cacheInfo(): Promise<{
        path: string;
        sizeBytes: number;
        exists: boolean;
        count: number;
        marksSizeBytes: number;
    }>;
    clearCache(): Promise<{ ok: boolean }>;
    pruneCache(keepPaths: string[]): Promise<{ removed: number }>;
    loadMarks(): Promise<string[]>;
    saveMarks(marks: string[]): Promise<{ ok: boolean }>;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── AudioFingerprintRenderer ───

class AudioFingerprintRenderer {
    /** No-op：保持 bootstrap 调用兼容 */
    async setup() {}

    public checkBinary() {
        return mod.checkBinary();
    }

    public calculateFingerprint(filePath: string) {
        return mod.calculateFingerprint(filePath);
    }

    public getFileHash(filePath: string) {
        return mod.fileHash(filePath);
    }

    public getCacheInfo() {
        return mod.cacheInfo();
    }

    public clearCache() {
        return mod.clearCache();
    }

    public pruneCache(keepPaths: string[]) {
        return mod.pruneCache(keepPaths);
    }

    public loadMarks() {
        return mod.loadMarks();
    }

    public saveMarks(marks: string[]) {
        return mod.saveMarks(marks);
    }
}

const audioFingerprint = new AudioFingerprintRenderer();
export default audioFingerprint;
