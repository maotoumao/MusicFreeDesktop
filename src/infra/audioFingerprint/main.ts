/**
 * audioFingerprint — 主进程层
 *
 * 职责:
 *  1. 调用 fpcalc 计算音频指纹（Chromaprint），供本地音乐去重
 *  2. 指纹磁盘缓存（常驻内存 + 防抖落盘 + 退出前同步刷盘）
 *  3. 手动版本标记文件的读写（与指纹缓存同目录共存亡）
 *
 * 设计说明:
 *  - fpcalc 二进制随包发布（res/bin/<platform>/），缺失时通过 check-binary 上报，
 *    渲染层给出下载指引而不是静默失败
 *  - 命中判定只用“路径 + mtimeMs + size”，文件未动就不重算
 */
import { app, ipcMain } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import { IPC, FPCALC_BIN_DIRS } from './common/constant';

type CacheEntry = { mtimeMs: number; size: number; fingerprint: number[]; duration: number };

function resolveFpcalcBinary(): string {
    const plat =
        process.platform === 'win32'
            ? FPCALC_BIN_DIRS.win32
            : process.platform === 'darwin'
              ? FPCALC_BIN_DIRS.darwin
              : FPCALC_BIN_DIRS.linux;
    const exe = process.platform === 'win32' ? 'fpcalc.exe' : 'fpcalc';
    if (app.isPackaged) {
        // extraResource 把 res/ 整个拷进 resources，实际落点可能是 resources/res 或 resources
        for (const base of ['res', '']) {
            const candidate = path.join(process.resourcesPath, base, 'bin', plat, exe);
            try {
                fs.accessSync(candidate, fs.constants.X_OK);
                return candidate;
            } catch {
                // 试下一个候选
            }
        }
        return path.join(process.resourcesPath, 'res', 'bin', plat, exe);
    }
    return path.join(app.getAppPath(), 'res', 'bin', plat, exe);
}

function cacheDir(appConfig: IAppConfigReader): string {
    return appConfig.getConfigByKey('localMusic.fingerprintCacheDir') || app.getPath('userData');
}

function cachePath(appConfig: IAppConfigReader): string {
    return path.join(cacheDir(appConfig), 'fingerprint-cache.json');
}

function marksPath(appConfig: IAppConfigReader): string {
    return path.join(cacheDir(appConfig), 'version-marks.json');
}

async function readCacheFile(cacheFile: string): Promise<Record<string, CacheEntry>> {
    try {
        return JSON.parse(await fsp.readFile(cacheFile, 'utf-8'));
    } catch {
        return {};
    }
}

async function runFpcalc(filePath: string): Promise<{ fingerprint: number[]; duration: number }> {
    const bin = resolveFpcalcBinary();
    return new Promise((resolve, reject) => {
        // -json -raw：官方推荐的机器可读输出；-raw 让 fingerprint 为原始整数数组
        const child = spawn(bin, ['-json', '-raw', filePath], { windowsHide: true });
        let out = '';
        let err = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('fpcalc 超时'));
        }, 60000);
        child.stdout.on('data', (d) => {
            out += String(d);
        });
        child.stderr.on('data', (d) => {
            err += String(d);
        });
        child.on('error', (e) => {
            clearTimeout(timer);
            reject(e);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new Error(err || `fpcalc 退出码 ${code}`));
                return;
            }
            try {
                const parsed = JSON.parse(out) as {
                    fingerprint?: unknown;
                    duration?: unknown;
                };
                if (!Array.isArray(parsed.fingerprint) || typeof parsed.duration !== 'number') {
                    reject(new Error('fpcalc 输出解析失败'));
                    return;
                }
                resolve({
                    fingerprint: (parsed.fingerprint as number[]).filter((n) => Number.isFinite(n)),
                    duration: parsed.duration,
                });
            } catch {
                reject(new Error('fpcalc 输出解析失败'));
            }
        });
    });
}

class AudioFingerprintManager {
    private appConfig!: IAppConfigReader;
    private isSetup = false;

    /** 常驻内存的指纹缓存：读零 IO，写攒批落盘 */
    private memCache: Record<string, CacheEntry> | null = null;
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingWrites = 0;

    /** 缓存文件写串行化：同一时刻最多一个完整写，避免交叉写撕裂 JSON */
    private cacheWriteChain: Promise<unknown> = Promise.resolve();

    public setup(deps: { appConfig: IAppConfigReader }) {
        if (this.isSetup) return;
        this.appConfig = deps.appConfig;

        // 退出前把内存缓存刷盘（崩溃丢的顶多一批增量，下次重算自愈）
        app.on('before-quit', () => {
            try {
                if (this.flushTimer) {
                    clearTimeout(this.flushTimer);
                    this.flushTimer = null;
                }
                if (this.memCache) {
                    fs.writeFileSync(
                        cachePath(this.appConfig),
                        JSON.stringify(this.memCache),
                        'utf-8',
                    );
                }
            } catch {
                // 退出时刷不进去下次重算
            }
        });

        this.registerIpcHandlers();
        this.isSetup = true;
    }

    // ─── 内部方法 ───

    private async getMemCache(): Promise<Record<string, CacheEntry>> {
        if (!this.memCache) this.memCache = await readCacheFile(cachePath(this.appConfig));
        return this.memCache;
    }

    private enqueueCacheWrite<T>(task: () => Promise<T>): Promise<T> {
        const run = this.cacheWriteChain.then(task, task);
        this.cacheWriteChain = run.catch(() => undefined);
        return run;
    }

    private scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flushCacheFile();
        }, 2000);
    }

    private async flushCacheFile(): Promise<void> {
        await this.enqueueCacheWrite(async () => {
            const current = this.memCache;
            if (current) {
                await fsp.writeFile(cachePath(this.appConfig), JSON.stringify(current), 'utf-8');
            }
        });
        this.pendingWrites = 0;
    }

    private async flushCacheNow(): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flushCacheFile();
    }

    private registerIpcHandlers(): void {
        ipcMain.handle(IPC.CHECK_BINARY, async () => {
            const bin = resolveFpcalcBinary();
            try {
                await fsp.access(bin, fs.constants.X_OK);
                return { ok: true, path: bin };
            } catch {
                return { ok: false, path: bin, error: `找不到 fpcalc: ${bin}` };
            }
        });

        ipcMain.handle(IPC.CALCULATE, async (_evt, filePath: string) => {
            try {
                const st = await fsp.stat(filePath);
                if (!st.isFile()) return { status: 'error', message: '不是有效文件' };
                const cache = await this.getMemCache();
                const hit = cache[filePath];
                if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
                    return {
                        status: 'success',
                        fingerprint: hit.fingerprint,
                        duration: hit.duration,
                        cached: true,
                    };
                }
                const r = await runFpcalc(filePath);
                cache[filePath] = {
                    mtimeMs: st.mtimeMs,
                    size: st.size,
                    fingerprint: r.fingerprint,
                    duration: r.duration,
                };
                this.pendingWrites += 1;
                // 攒够一批就刷一次，杀进程/断电最多丢一批
                if (this.pendingWrites >= 50) await this.flushCacheFile();
                else this.scheduleFlush();
                return {
                    status: 'success',
                    fingerprint: r.fingerprint,
                    duration: r.duration,
                    cached: false,
                };
            } catch (e: any) {
                return { status: 'error', message: e?.message ?? '计算失败' };
            }
        });

        ipcMain.handle(IPC.FILE_HASH, async (_evt, filePath: string) => {
            try {
                const hash = await new Promise<string>((resolve, reject) => {
                    const h = crypto.createHash('md5');
                    const s = fs.createReadStream(filePath);
                    s.on('data', (d) => h.update(d));
                    s.on('end', () => resolve(h.digest('hex')));
                    s.on('error', reject);
                });
                return { status: 'success', hash };
            } catch (e: any) {
                return { status: 'error', message: e?.message ?? 'hash 失败' };
            }
        });

        ipcMain.handle(IPC.CACHE_INFO, async () => {
            // 先落盘再读，保证看到的是内存里的最新状态
            await this.flushCacheNow();
            const cacheFile = cachePath(this.appConfig);
            try {
                const st = await fsp.stat(cacheFile);
                if (!st.isFile()) {
                    return {
                        path: cacheFile,
                        sizeBytes: 0,
                        exists: false,
                        count: 0,
                        marksSizeBytes: 0,
                    };
                }
                const cache = await this.getMemCache();
                let marksSizeBytes = 0;
                try {
                    const marksStat = await fsp.stat(marksPath(this.appConfig));
                    if (marksStat.isFile()) marksSizeBytes = marksStat.size;
                } catch {
                    // 无标记文件=0
                }
                return {
                    path: cacheFile,
                    sizeBytes: st.size,
                    exists: true,
                    count: Object.keys(cache).length,
                    marksSizeBytes,
                };
            } catch {
                return {
                    path: cacheFile,
                    sizeBytes: 0,
                    exists: false,
                    count: 0,
                    marksSizeBytes: 0,
                };
            }
        });

        ipcMain.handle(IPC.CLEAR_CACHE, async () => {
            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }
            this.memCache = {};
            return this.enqueueCacheWrite(async () => {
                try {
                    await fsp.unlink(cachePath(this.appConfig));
                } catch {
                    // 缓存文件不存在也算成功
                }
                try {
                    await fsp.unlink(marksPath(this.appConfig));
                } catch {
                    // 标记与缓存共存亡：清库顺手清掉
                }
                return { ok: true };
            });
        });

        ipcMain.handle(IPC.PRUNE_CACHE, async (_evt, keepPaths: string[]) => {
            // 空快照不删：库还没加载出来时 keep 为空，误删等于清空全库缓存
            if (!keepPaths.length) return { removed: 0 };
            try {
                const cache = await this.getMemCache();
                const keep = new Set(keepPaths);
                let removed = 0;
                for (const key of Object.keys(cache)) {
                    if (!keep.has(key)) {
                        delete cache[key];
                        removed += 1;
                    }
                }
                if (removed) await this.flushCacheNow();
                return { removed };
            } catch {
                return { removed: 0 };
            }
        });

        ipcMain.handle(IPC.MARKS_LOAD, async () => {
            try {
                const raw = await fsp.readFile(marksPath(this.appConfig), 'utf-8');
                const parsed: unknown = JSON.parse(raw);
                if (Array.isArray(parsed))
                    return parsed.filter((x): x is string => typeof x === 'string');
                return [];
            } catch {
                // 无文件=无标记
                return [];
            }
        });

        ipcMain.handle(IPC.MARKS_SAVE, async (_evt, marks: string[]) => {
            try {
                await fsp.writeFile(marksPath(this.appConfig), JSON.stringify(marks), 'utf-8');
                return { ok: true };
            } catch {
                return { ok: false };
            }
        });
    }
}

const audioFingerprint = new AudioFingerprintManager();
export default audioFingerprint;
