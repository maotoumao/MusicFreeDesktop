/**
 * backup — 主进程层
 *
 * 职责:
 *  1. 编排导出/导入流程（文件 + WebDAV）
 *  2. 文件 I/O（读写备份 JSON）
 *  3. WebDAV 客户端（备份/恢复/测试连接）
 *  4. 进度上报（通过 webContents.send 推送到 renderer）
 *
 * 数据操作全部在主进程闭环完成，renderer 不经手原始歌单数据。
 */
import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, type WebDAVClient, AuthType } from 'webdav';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import type {
    IBackupData,
    IBackupOrigin,
    IBackupProvider,
    IBackupResult,
    RestoreMode,
    IBackupProgress,
} from '@appTypes/infra/backup';
import { LOCAL_PLUGIN_NAME } from '@common/constant';
import { IPC, WEBDAV_BACKUP_PATH } from './common/constant';

class BackupManager {
    private isSetup = false;
    private windowManager!: IWindowManager;
    private appConfig!: IAppConfigReader;
    private backupProvider!: IBackupProvider;

    public setup(deps: {
        windowManager: IWindowManager;
        appConfig: IAppConfigReader;
        backupProvider: IBackupProvider;
    }) {
        if (this.isSetup) return;

        this.windowManager = deps.windowManager;
        this.appConfig = deps.appConfig;
        this.backupProvider = deps.backupProvider;

        this.registerIpcHandlers();

        this.isSetup = true;
    }

    // ─── 内部方法 ───

    private registerIpcHandlers(): void {
        // ─── 备份到文件 ───

        ipcMain.handle(
            IPC.BACKUP_TO_FILE,
            async (_evt, filePath: string): Promise<IBackupResult> => {
                try {
                    const data = this.buildBackupData();
                    await fsp.writeFile(filePath, JSON.stringify(data), 'utf-8');
                    const songsCount = data.musicSheets.reduce(
                        (sum, s) => sum + s.musicList.length,
                        0,
                    );
                    return {
                        success: true,
                        sheetsCount: data.musicSheets.length,
                        songsCount,
                    };
                } catch (e) {
                    return {
                        success: false,
                        error: e instanceof Error ? e.message : String(e),
                    };
                }
            },
        );

        // ─── 从文件恢复 ───

        ipcMain.handle(
            IPC.RESTORE_FROM_FILE,
            async (_evt, filePath: string, mode: RestoreMode): Promise<IBackupResult> => {
                try {
                    const raw = await fsp.readFile(filePath, 'utf-8');
                    const { musicSheets, localIgnored } = gateLocalSongs(parseBackupData(raw));

                    const importResult = this.backupProvider.importSheets(
                        musicSheets,
                        mode,
                        (current, total, sheetTitle) => {
                            this.sendProgress({ current, total, sheetTitle });
                        },
                    );

                    return {
                        success: true,
                        sheetsCount: importResult.sheetsCount,
                        songsCount: importResult.songsCount,
                        localIgnored,
                    };
                } catch (e) {
                    return {
                        success: false,
                        error: e instanceof Error ? e.message : String(e),
                    };
                }
            },
        );

        // ─── 备份到 WebDAV ───

        ipcMain.handle(IPC.BACKUP_TO_WEBDAV, async (): Promise<IBackupResult> => {
            try {
                const client = this.createWebDAVClient();
                const data = this.buildBackupData();
                const json = JSON.stringify(data);

                // 确保目录存在
                const dirExists = await client.exists('/MusicFree');
                if (!dirExists) {
                    await client.createDirectory('/MusicFree');
                }

                await client.putFileContents(WEBDAV_BACKUP_PATH, json, {
                    overwrite: true,
                    contentLength: Buffer.byteLength(json, 'utf-8'),
                });

                const songsCount = data.musicSheets.reduce((sum, s) => sum + s.musicList.length, 0);
                return {
                    success: true,
                    sheetsCount: data.musicSheets.length,
                    songsCount,
                };
            } catch (e) {
                return {
                    success: false,
                    error: e instanceof Error ? e.message : String(e),
                };
            }
        });

        // ─── 从 WebDAV 恢复 ───

        ipcMain.handle(
            IPC.RESTORE_FROM_WEBDAV,
            async (_evt, mode: RestoreMode): Promise<IBackupResult> => {
                try {
                    const client = this.createWebDAVClient();

                    const exists = await client.exists(WEBDAV_BACKUP_PATH);
                    if (!exists) {
                        return { success: false, error: 'webdav_backup_file_not_exist' };
                    }

                    const raw = (await client.getFileContents(WEBDAV_BACKUP_PATH, {
                        format: 'text',
                    })) as string;
                    const { musicSheets, localIgnored } = gateLocalSongs(parseBackupData(raw));

                    const importResult = this.backupProvider.importSheets(
                        musicSheets,
                        mode,
                        (current, total, sheetTitle) => {
                            this.sendProgress({ current, total, sheetTitle });
                        },
                    );

                    return {
                        success: true,
                        sheetsCount: importResult.sheetsCount,
                        songsCount: importResult.songsCount,
                        localIgnored,
                    };
                } catch (e) {
                    return {
                        success: false,
                        error: e instanceof Error ? e.message : String(e),
                    };
                }
            },
        );

        // ─── 测试 WebDAV 连通性 ───

        ipcMain.handle(IPC.TEST_WEBDAV, async (): Promise<IBackupResult> => {
            try {
                const client = this.createWebDAVClient();
                await client.getDirectoryContents('/');
                return { success: true };
            } catch (e) {
                return {
                    success: false,
                    error: e instanceof Error ? e.message : String(e),
                };
            }
        });
    }

    /** 组装备份数据（主进程内直接调用 provider，不经 IPC） */
    private buildBackupData(): IBackupData {
        const sheets = this.backupProvider.getExportableSheets();
        return {
            version: 1,
            createdAt: Date.now(),
            origin: {
                platform: 'desktop',
                appVersion: globalContext.appVersion,
                installationId: getInstallationId(),
            },
            musicSheets: sheets.map((sheet) => ({
                id: sheet.id,
                title: sheet.title,
                musicList: this.backupProvider.getSheetMusicRaw(sheet.id).map(withoutEmbeddedCover),
            })),
        };
    }

    /** 从 appConfig 读取 WebDAV 配置并创建客户端 */
    private createWebDAVClient(): WebDAVClient {
        const url = this.appConfig.getConfigByKey('backup.webdav.url');
        const username = this.appConfig.getConfigByKey('backup.webdav.username');
        const password = this.appConfig.getConfigByKey('backup.webdav.password');

        if (!url || !username || !password) {
            throw new Error('webdav_data_not_complete');
        }

        return createClient(url, {
            authType: AuthType.Password,
            username,
            password,
        });
    }

    /** 向主窗口发送进度事件 */
    private sendProgress(progress: IBackupProgress) {
        this.windowManager.sendTo('main', IPC.PROGRESS, progress);
    }
}

/**
 * 去掉本地歌曲内嵌的 data URL 封面：播放时会从文件重新读取，留在备份里只会让文件变大。
 * 在线歌曲的字段（含插件给的 data URL 封面）原样保留。
 */
function withoutEmbeddedCover(item: IMusic.IMusicItem): IMusic.IMusicItem {
    if (
        item.platform !== LOCAL_PLUGIN_NAME ||
        typeof item.artwork !== 'string' ||
        !item.artwork.startsWith('data:')
    ) {
        return item;
    }
    const { artwork: _artwork, ...rest } = item;
    return rest as IMusic.IMusicItem;
}

/** 安装标识文件，位于用户数据目录：随应用升级保留，清除数据后重新生成 */
const INSTALLATION_ID_FILE = 'installation-id';
let installationId: string | null = null;

/** 本机安装标识（跨端备份协议 origin.installationId），首次使用时生成 */
function getInstallationId(): string {
    if (installationId) return installationId;
    const file = path.join(globalContext.appPath.userData, INSTALLATION_ID_FILE);
    try {
        installationId = fs.readFileSync(file, 'utf8').trim() || null;
    } catch {
        installationId = null;
    }
    if (!installationId) {
        installationId = randomUUID();
        fs.writeFileSync(file, installationId, 'utf8');
    }
    return installationId;
}

/**
 * 本地歌曲只恢复本机能播放的：
 * - 备份带安装标识：仅同一安装产出的备份恢复本地歌曲
 * - 旧备份没有标识：文件在本机存在才恢复
 * 跳过的歌按 platform + id 去重计数。
 */
function gateLocalSongs(data: IBackupData): {
    musicSheets: IBackupData['musicSheets'];
    localIgnored: number;
} {
    const backupInstallationId = data.origin?.installationId;
    const sameInstallation =
        typeof backupInstallationId === 'string' &&
        backupInstallationId !== '' &&
        backupInstallationId === getInstallationId();
    const ignored = new Set<string>();
    const musicSheets = data.musicSheets.map((sheet) => ({
        ...sheet,
        musicList: sheet.musicList.filter((item) => {
            if (item?.platform !== LOCAL_PLUGIN_NAME || sameInstallation) return true;
            const keep = !backupInstallationId && localFileExists(item);
            if (!keep) ignored.add(String(item.id));
            return keep;
        }),
    }));
    return { musicSheets, localIgnored: ignored.size };
}

/** 本地歌曲对应的文件在本机是否存在（优先 localPath，其次 file:// 地址） */
function localFileExists(item: IMusic.IMusicItem): boolean {
    let filePath = typeof item.localPath === 'string' ? item.localPath : null;
    if (!filePath && typeof item.url === 'string' && item.url.startsWith('file:')) {
        try {
            filePath = fileURLToPath(item.url);
        } catch {
            filePath = null;
        }
    }
    if (!filePath) return false;
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/** 手机端 1.0 起的备份信封标识 */
const BACKUP_ENVELOPE_FORMAT = 'musicfree-backup';
/** 「我喜欢」歌单 id：跨端备份协议冻结的 wire 值 */
const FAVORITE_SHEET_ID = 'favorite';

/** 解析备份数据（兼容旧版无 version 字段的格式与手机端 v2 信封） */
function parseBackupData(raw: string): IBackupData {
    const data = JSON.parse(raw);

    // 旧版格式：无 version 字段，直接有 musicSheets 数组
    if (!data.version && Array.isArray(data.musicSheets)) {
        return {
            version: 1,
            createdAt: Date.now(),
            musicSheets: data.musicSheets,
        };
    }

    if (data.version === 1 && Array.isArray(data.musicSheets)) {
        return { ...(data as IBackupData), origin: parseOrigin(data.origin) };
    }

    // 更高版本按跨端备份协议尽力读取已知段
    if (
        data.format === BACKUP_ENVELOPE_FORMAT &&
        Number.isInteger(data.version) &&
        data.version >= 2
    ) {
        return parseEnvelopeV2(data);
    }

    throw new Error('unsupported_backup_format');
}

/**
 * 手机端 v2 备份（规则见手机端仓库 docs/跨端备份协议.md），桌面端只恢复 sections.musicSheets：
 * - 歌单段须恰有一个「我喜欢」，否则按缺段处理；缺段时报错而不是按空歌单导入，否则覆盖模式会清空现有歌单
 * - 曲目缺 platform / id 时丢弃，缺标题补空串
 * - 本地歌曲与其他格式一样，由 gateLocalSongs 按安装标识决定是否恢复
 */
function parseEnvelopeV2(data: any): IBackupData {
    const sheets = data.sections?.musicSheets;
    if (
        !Array.isArray(sheets) ||
        sheets.filter((sheet) => sheet?.id === FAVORITE_SHEET_ID).length !== 1
    ) {
        throw new Error('no_playlists_in_backup');
    }

    return {
        version: 1,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        origin: parseOrigin(data.origin),
        musicSheets: sheets
            .filter((sheet) => typeof sheet?.id === 'string' && Array.isArray(sheet.musicList))
            .map((sheet) => ({
                id: sheet.id,
                title: typeof sheet.title === 'string' ? sheet.title : '',
                musicList: sheet.musicList.filter(isImportableMusicItem).map((item: any) => ({
                    ...item,
                    id: String(item.id),
                    title: typeof item.title === 'string' ? item.title : '',
                })),
            })),
    };
}

function isImportableMusicItem(item: any): boolean {
    const hasId = (typeof item?.id === 'string' && item.id !== '') || Number.isFinite(item?.id);
    return typeof item?.platform === 'string' && item.platform !== '' && hasId;
}

/** 只取 origin 中类型正确的字段 */
function parseOrigin(origin: any): IBackupOrigin | undefined {
    if (!origin || typeof origin !== 'object') return undefined;
    const pick = (value: unknown) => (typeof value === 'string' ? value : undefined);
    return {
        platform: pick(origin.platform),
        appVersion: pick(origin.appVersion),
        installationId: pick(origin.installationId),
    };
}

const backup = new BackupManager();
export default backup;
