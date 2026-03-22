/**
 * localMusic — Renderer 层
 *
 * 职责：
 * - 封装 Preload Bridge，提供类型安全的 API
 * - getAllMusicItems 异步（走 IPC），数据由 Store 层缓存
 * - 扫描操作保持异步 IPC
 */

import { CONTEXT_BRIDGE_KEY } from './common/constant';
import type { IScanFolder, IScanProgress, IScanResult } from '@appTypes/infra/localMusic';

// ─── Preload Bridge ───

interface IMod {
    getAllMusicItems(): Promise<IMusic.IMusicItem[]>;

    getScanFolders(): Promise<IScanFolder[]>;
    syncScanFolders(folderPaths: string[]): Promise<IScanResult>;

    deleteItems(musicBases: IMedia.IMediaBase[]): Promise<void>;

    onLibraryChanged(cb: () => void): () => void;
    onScanProgress(cb: (progress: IScanProgress) => void): () => void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── LocalMusicRenderer ───

class LocalMusicRenderer {
    /** No-op：保持 bootstrap 调用兼容 */
    async setup() {}

    // ─── 全量歌曲（异步 IPC） ───

    public getAllMusicItems(): Promise<IMusic.IMusicItem[]> {
        return mod.getAllMusicItems();
    }

    // ─── 删除 ───

    /**
     * 将本地歌曲文件移至回收站并删除 local_music DB 记录。
     * 仅处理 platform === LOCAL_PLUGIN_NAME 的项。
     */
    public deleteItems(musicBases: IMedia.IMediaBase[]): Promise<void> {
        return mod.deleteItems(musicBases);
    }

    // ─── 事件 ───

    public onLibraryChanged(cb: () => void): () => void {
        return mod.onLibraryChanged(cb);
    }

    public onScanProgress(cb: (progress: IScanProgress) => void): () => void {
        return mod.onScanProgress(cb);
    }

    // ─── 扫描文件夹管理 ───

    public getScanFolders(): Promise<IScanFolder[]> {
        return mod.getScanFolders();
    }

    /**
     * 同步扫描文件夹列表并触发扫描。
     * 主进程会与 DB 做 diff：新增的插入、移除的删除、保留的 rescan。
     */
    public syncScanFolders(folderPaths: string[]): Promise<IScanResult> {
        return mod.syncScanFolders(folderPaths);
    }
}

const localMusic = new LocalMusicRenderer();
export default localMusic;
