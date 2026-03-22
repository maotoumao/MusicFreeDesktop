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
import fsp from 'fs/promises';
import { createClient, type WebDAVClient, AuthType } from 'webdav';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import type {
    IBackupData,
    IBackupProvider,
    IBackupResult,
    RestoreMode,
    IBackupProgress,
} from '@appTypes/infra/backup';
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
                    const data = parseBackupData(raw);

                    const importResult = this.backupProvider.importSheets(
                        data.musicSheets,
                        mode,
                        (current, total, sheetTitle) => {
                            this.sendProgress({ current, total, sheetTitle });
                        },
                    );

                    return {
                        success: true,
                        sheetsCount: importResult.sheetsCount,
                        songsCount: importResult.songsCount,
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
                    const data = parseBackupData(raw);

                    const importResult = this.backupProvider.importSheets(
                        data.musicSheets,
                        mode,
                        (current, total, sheetTitle) => {
                            this.sendProgress({ current, total, sheetTitle });
                        },
                    );

                    return {
                        success: true,
                        sheetsCount: importResult.sheetsCount,
                        songsCount: importResult.songsCount,
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
            musicSheets: sheets.map((sheet) => ({
                id: sheet.id,
                title: sheet.title,
                musicList: this.backupProvider.getSheetMusicRaw(sheet.id),
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

/** 解析备份数据（兼容旧版无 version 字段的格式） */
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

    if (data.version === 1) {
        return data as IBackupData;
    }

    throw new Error('unsupported_backup_format');
}

const backup = new BackupManager();
export default backup;
