/**
 * 数据库模块
 * 
 * 此模块负责加载数据库相关的功能，提供渲染进程需要的业务逻辑。
 */


import { app } from "electron";
import path from "node:path";
import Database from "better-sqlite3";


const appDbPath = path.resolve(app.getPath("userData"), "./app-database/database.db");

const database = new Database(appDbPath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");      // 启用外键支持
database.pragma("synchronous = NORMAL");   // WAL模式下推荐设置

// 数据库版本号
const DATABASE_LATEST_VERSION = 1;

// 创建初始表结构
function createInitialTables() {
    // 创建歌单表（IMusicSheetModel）
    database.exec(`
        CREATE TABLE IF NOT EXISTS LocalMusicSheets (
            platform TEXT NOT NULL,
            id TEXT NOT NULL,
            title TEXT NOT NULL,
            artwork TEXT,
            description TEXT,
            worksNum INTEGER DEFAULT 0,
            playCount INTEGER DEFAULT 0,
            createAt INTEGER,
            artist TEXT,
            _raw TEXT NOT NULL,     -- (存储原始JSON数据)
            _sortIndex REAL, -- $$sortIndex
            
            -- 联合主键
            PRIMARY KEY (platform, id)
        );
    `);

    // 创建音乐项表（IMusicItemModel）
    database.exec(`
        CREATE TABLE IF NOT EXISTS LocalMusicItems (
            _key INTEGER PRIMARY KEY AUTOINCREMENT,  
            platform TEXT NOT NULL,
            id TEXT NOT NULL,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            duration REAL,
            album TEXT,
            artwork TEXT,
            _timestamp INTEGER NOT NULL, 
            _raw TEXT NOT NULL,        -- 替代 $$raw
            _sortIndex REAL,
            _musicSheetId TEXT NOT NULL,    -- 替代 $$musicSheetId
            _musicSheetPlatform TEXT NOT NULL, -- 替代 $$musicSheetPlatform
            
            -- 添加复合唯一约束防止同一歌单重复添加相同歌曲
            UNIQUE (_musicSheetPlatform, _musicSheetId, platform, id),
            
            -- 外键引用歌单表的联合主键
            FOREIGN KEY (_musicSheetPlatform, _musicSheetId)
            REFERENCES LocalMusicSheets(platform, id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        );
    `);

    // 创建索引优化查询性能
    database.exec("CREATE INDEX IF NOT EXISTS idx_items_coreid ON LocalMusicItems(platform, id)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_items_sheet ON LocalMusicItems(_musicSheetPlatform, _musicSheetId)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_sheets_platform ON LocalMusicSheets(platform)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_items_artist ON LocalMusicItems(artist)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_sheets_sort ON LocalMusicSheets(_sortIndex)");

    // 创建star的歌单表（IMusicSheetModel）
    database.exec(`
        CREATE TABLE IF NOT EXISTS StarredMusicSheets (
            platform TEXT NOT NULL,
            id TEXT NOT NULL,
            title TEXT NOT NULL,
            artwork TEXT,
            description TEXT,
            worksNum INTEGER DEFAULT 0,
            playCount INTEGER DEFAULT 0,
            createAt INTEGER,
            artist TEXT,
            _raw TEXT NOT NULL,     -- $$raw (存储原始JSON数据)
            _sortIndex REAL, -- $$sortIndex
            
            -- 联合主键
            PRIMARY KEY (platform, id)
        );
    `);
}

function migrateDatabase() {
    let currentVersion = database.pragma("user_version", { simple: true }) as number;

    if (currentVersion >= DATABASE_LATEST_VERSION) {
        return;
    }
    if (!currentVersion) {
        currentVersion = 0;
    }

    // 在事务中执行升级
    const upgrade = database.transaction(() => {
        for (let version = currentVersion + 1; version <= DATABASE_LATEST_VERSION; version++) {
            switch (version) {
                case 1:
                    createInitialTables();
                    break;
                // 未来的版本升级可以在这里添加
                // case 2:
                //     upgradeToVersion2();
                //     break;
                default:
                    throw new Error(`Unknown database version: ${version}`);
            }

            database.pragma(`user_version = ${version}`);
        }
    });

    upgrade();

}

migrateDatabase();


//////////////////// 歌单增删查改

class LocalMusicSheetDB {
    private static readonly SORT_BASE = 1000; // 排序基础值
    private static readonly SORT_INCREMENT = 1000; // 排序增量
    private static readonly MIN_SORT_INTERVAL = 0.000001; // 最小排序间隔，低于此值需要重新均衡

    /**
     * 添加歌单
     * @param musicSheet 歌单数据
     * @returns 是否添加成功
     */
    static addMusicSheet(musicSheet: IDataBaseModel.IMusicSheetModel): boolean {
        try {
            const insertStmt = database.prepare(`
                INSERT INTO LocalMusicSheets 
                (platform, id, title, artwork, description, worksNum, playCount, createAt, artist, _raw, _sortIndex)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // 如果没有指定排序索引，设置为当前最大值+增量
            let sortIndex = musicSheet._sortIndex;
            if (sortIndex === undefined || sortIndex === null) {
                const maxSortStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM LocalMusicSheets");
                const result = maxSortStmt.get() as { maxSort: number | null };
                sortIndex = (result.maxSort || 0) + this.SORT_INCREMENT;
            }

            const result = insertStmt.run(
                musicSheet.platform,
                musicSheet.id,
                musicSheet.title,
                musicSheet.artwork || null,
                musicSheet.description || null,
                musicSheet.worksNum || 0,
                musicSheet.playCount || 0,
                musicSheet.createAt || Date.now(),
                musicSheet.artist || null,
                musicSheet._raw,
                sortIndex,
            );

            return result.changes > 0;
        } catch (error) {
            console.error("添加歌单失败:", error);
            return false;
        }
    }

    /**
     * 批量添加歌单
     * @param musicSheets 歌单数据数组
     * @returns 成功添加的数量
     */
    static batchAddMusicSheets(musicSheets: IDataBaseModel.IMusicSheetModel[]): number {
        if (!musicSheets.length) return 0;

        try {
            const transaction = database.transaction(() => {
                let successCount = 0;

                // 获取当前最大排序值
                const maxSortStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM LocalMusicSheets");
                const result = maxSortStmt.get() as { maxSort: number | null };
                let currentMaxSort = result.maxSort || 0;

                const insertStmt = database.prepare(`
                    INSERT INTO LocalMusicSheets 
                    (platform, id, title, artwork, description, worksNum, playCount, createAt, artist, _raw, _sortIndex)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const sheet of musicSheets) {
                    try {
                        let sortIndex = sheet._sortIndex;
                        if (sortIndex === undefined || sortIndex === null) {
                            currentMaxSort += this.SORT_INCREMENT;
                            sortIndex = currentMaxSort;
                        }

                        const insertResult = insertStmt.run(
                            sheet.platform,
                            sheet.id,
                            sheet.title,
                            sheet.artwork || null,
                            sheet.description || null,
                            sheet.worksNum || 0,
                            sheet.playCount || 0,
                            sheet.createAt || Date.now(),
                            sheet.artist || null,
                            sheet._raw,
                            sortIndex,
                        );

                        if (insertResult.changes > 0) {
                            successCount++;
                        }
                    } catch (error) {
                        console.warn(`批量添加歌单失败 (${sheet.platform}:${sheet.id}):`, error);
                    }
                }

                return successCount;
            });

            return transaction();
        } catch (error) {
            console.error("批量添加歌单失败:", error);
            return 0;
        }
    }

    /**
     * 删除歌单
     * @param platform 平台
     * @param id 歌单ID
     * @returns 是否删除成功
     */
    static deleteMusicSheet(platform: string, id: string): boolean {
        try {
            const deleteStmt = database.prepare("DELETE FROM LocalMusicSheets WHERE platform = ? AND id = ?");
            const result = deleteStmt.run(platform, id);
            return result.changes > 0;
        } catch (error) {
            console.error("删除歌单失败:", error);
            return false;
        }
    }

    /**
     * 批量删除歌单
     * @param sheets 要删除的歌单标识数组 {platform, id}
     * @returns 成功删除的数量
     */
    static batchDeleteMusicSheets(sheets: Array<{ platform: string; id: string }>): number {
        if (!sheets.length) return 0;

        try {
            const transaction = database.transaction(() => {
                let successCount = 0;
                const deleteStmt = database.prepare("DELETE FROM LocalMusicSheets WHERE platform = ? AND id = ?");

                for (const sheet of sheets) {
                    try {
                        const result = deleteStmt.run(sheet.platform, sheet.id);
                        if (result.changes > 0) {
                            successCount++;
                        }
                    } catch (error) {
                        console.warn(`批量删除歌单失败 (${sheet.platform}:${sheet.id}):`, error);
                    }
                }

                return successCount;
            });

            return transaction();
        } catch (error) {
            console.error("批量删除歌单失败:", error);
            return 0;
        }
    }

    /**
     * 查询单个歌单
     * @param platform 平台
     * @param id 歌单ID
     * @returns 歌单数据或null
     */
    static getMusicSheet(platform: string, id: string): IDataBaseModel.IMusicSheetModel | null {
        try {
            const selectStmt = database.prepare(`
                SELECT * FROM LocalMusicSheets 
                WHERE platform = ? AND id = ?
            `);
            const result = selectStmt.get(platform, id) as any;

            if (!result) return null;

            return {
                platform: result.platform,
                id: result.id,
                title: result.title,
                artwork: result.artwork,
                description: result.description,
                worksNum: result.worksNum,
                playCount: result.playCount,
                createAt: result.createAt,
                artist: result.artist,
                _raw: result._raw,
                _sortIndex: result._sortIndex,
            };
        } catch (error) {
            console.error("查询歌单失败:", error);
            return null;
        }
    }

    /**
     * 查询所有歌单
     * @param orderBy 排序字段，默认按_sortIndex排序
     * @param order 排序方向，'ASC' 或 'DESC'，默认ASC
     * @returns 歌单数组
     */
    static getAllMusicSheets(orderBy: string = "_sortIndex", order: "ASC" | "DESC" = "ASC"): IDataBaseModel.IMusicSheetModel[] {
        try {
            // 验证排序字段，防止SQL注入
            const allowedFields = ["_sortIndex", "title", "createAt", "artist", "playCount"];
            if (!allowedFields.includes(orderBy)) {
                orderBy = "_sortIndex";
            }

            const selectStmt = database.prepare(`
                SELECT * FROM LocalMusicSheets 
                ORDER BY ${orderBy} ${order}
            `);
            const results = selectStmt.all() as any[];

            return results.map(result => ({
                platform: result.platform,
                id: result.id,
                title: result.title,
                artwork: result.artwork,
                description: result.description,
                worksNum: result.worksNum,
                playCount: result.playCount,
                createAt: result.createAt,
                artist: result.artist,
                _raw: result._raw,
                _sortIndex: result._sortIndex,
            }));
        } catch (error) {
            console.error("查询所有歌单失败:", error);
            return [];
        }
    }

    /**
     * 按平台查询歌单
     * @param platform 平台名称
     * @param orderBy 排序字段
     * @param order 排序方向
     * @returns 歌单数组
     */
    static getMusicSheetsByPlatform(platform: string, orderBy: string = "_sortIndex", order: "ASC" | "DESC" = "ASC"): IDataBaseModel.IMusicSheetModel[] {
        try {
            const allowedFields = ["_sortIndex", "title", "createAt", "artist", "playCount"];
            if (!allowedFields.includes(orderBy)) {
                orderBy = "_sortIndex";
            }

            const selectStmt = database.prepare(`
                SELECT * FROM LocalMusicSheets 
                WHERE platform = ?
                ORDER BY ${orderBy} ${order}
            `);
            const results = selectStmt.all(platform) as any[];

            return results.map(result => ({
                platform: result.platform,
                id: result.id,
                title: result.title,
                artwork: result.artwork,
                description: result.description,
                worksNum: result.worksNum,
                playCount: result.playCount,
                createAt: result.createAt,
                artist: result.artist,
                _raw: result._raw,
                _sortIndex: result._sortIndex,
            }));
        } catch (error) {
            console.error("按平台查询歌单失败:", error);
            return [];
        }
    }

    /**
     * 更新歌单（部分更新）
     * @param platform 平台
     * @param id 歌单ID
     * @param updates 要更新的字段
     * @returns 是否更新成功
     */
    static updateMusicSheet(
        platform: string,
        id: string,
        updates: Partial<Omit<IDataBaseModel.IMusicSheetModel, "platform" | "id">>,
    ): boolean {
        try {
            if (Object.keys(updates).length === 0) {
                return false;
            }

            // 构建动态更新SQL
            const allowedFields = ["title", "artwork", "description", "worksNum", "playCount", "createAt", "artist", "_raw", "_sortIndex"];
            const updateFields: string[] = [];
            const values: any[] = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    updateFields.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updateFields.length === 0) {
                return false;
            }

            values.push(platform, id);
            const updateStmt = database.prepare(`
                UPDATE LocalMusicSheets 
                SET ${updateFields.join(", ")} 
                WHERE platform = ? AND id = ?
            `);

            const result = updateStmt.run(...values);
            return result.changes > 0;
        } catch (error) {
            console.error("更新歌单失败:", error);
            return false;
        }
    }

    /**
     * 批量更新歌单
     * @param updates 更新数据数组，每个元素包含 platform, id 和要更新的字段
     * @returns 成功更新的数量
     */
    static batchUpdateMusicSheets(
        updates: Array<{
            platform: string;
            id: string;
            data: Partial<Omit<IDataBaseModel.IMusicSheetModel, "platform" | "id">>;
        }>,
    ): number {
        if (!updates.length) return 0;

        try {
            const transaction = database.transaction(() => {
                let successCount = 0;

                for (const update of updates) {
                    try {
                        if (this.updateMusicSheet(update.platform, update.id, update.data)) {
                            successCount++;
                        }
                    } catch (error) {
                        console.warn(`批量更新歌单失败 (${update.platform}:${update.id}):`, error);
                    }
                }

                return successCount;
            });

            return transaction();
        } catch (error) {
            console.error("批量更新歌单失败:", error);
            return 0;
        }
    }

    /**
     * 更新歌单排序
     * @param platform 平台
     * @param id 歌单ID
     * @param newSortIndex 新的排序索引
     * @returns 是否更新成功
     */
    static updateMusicSheetSort(platform: string, id: string, newSortIndex: number): boolean {
        try {
            const updateStmt = database.prepare(`
                UPDATE LocalMusicSheets 
                SET _sortIndex = ? 
                WHERE platform = ? AND id = ?
            `);
            const result = updateStmt.run(newSortIndex, platform, id);
            return result.changes > 0;
        } catch (error) {
            console.error("更新歌单排序失败:", error);
            return false;
        }
    }

    /**
     * 在两个歌单之间插入新歌单（使用浮点数排序法）
     * @param platform 平台
     * @param id 歌单ID
     * @param afterPlatform 插入位置前一个歌单的平台（null表示插入到开头）
     * @param afterId 插入位置前一个歌单的ID（null表示插入到开头）
     * @param beforePlatform 插入位置后一个歌单的平台（null表示插入到末尾）
     * @param beforeId 插入位置后一个歌单的ID（null表示插入到末尾）
     * @returns 是否更新成功
     */
    static insertMusicSheetBetween(
        platform: string,
        id: string,
        afterPlatform: string | null,
        afterId: string | null,
        beforePlatform: string | null,
        beforeId: string | null,
    ): boolean {
        try {
            let newSortIndex: number;

            if (!afterPlatform && !afterId) {
                // 插入到开头
                const firstStmt = database.prepare("SELECT MIN(_sortIndex) as minSort FROM LocalMusicSheets");
                const result = firstStmt.get() as { minSort: number | null };
                newSortIndex = (result.minSort || this.SORT_BASE) - this.SORT_INCREMENT;
            } else if (!beforePlatform && !beforeId) {
                // 插入到末尾
                const lastStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM LocalMusicSheets");
                const result = lastStmt.get() as { maxSort: number | null };
                newSortIndex = (result.maxSort || this.SORT_BASE) + this.SORT_INCREMENT;
            } else {
                // 插入到中间
                const afterStmt = database.prepare("SELECT _sortIndex FROM LocalMusicSheets WHERE platform = ? AND id = ?");
                const beforeStmt = database.prepare("SELECT _sortIndex FROM LocalMusicSheets WHERE platform = ? AND id = ?");

                const afterResult = afterStmt.get(afterPlatform, afterId) as { _sortIndex: number } | undefined;
                const beforeResult = beforeStmt.get(beforePlatform, beforeId) as { _sortIndex: number } | undefined;

                if (!afterResult || !beforeResult) {
                    return false;
                }

                newSortIndex = (afterResult._sortIndex + beforeResult._sortIndex) / 2;

                // 检查是否需要重新均衡
                if (Math.abs(beforeResult._sortIndex - afterResult._sortIndex) < this.MIN_SORT_INTERVAL) {
                    this.rebalanceSortIndexes();
                    // 重新计算新的排序值
                    const newAfterResult = afterStmt.get(afterPlatform, afterId) as { _sortIndex: number } | undefined;
                    const newBeforeResult = beforeStmt.get(beforePlatform, beforeId) as { _sortIndex: number } | undefined;
                    if (newAfterResult && newBeforeResult) {
                        newSortIndex = (newAfterResult._sortIndex + newBeforeResult._sortIndex) / 2;
                    }
                }
            }

            return this.updateMusicSheetSort(platform, id, newSortIndex);
        } catch (error) {
            console.error("插入歌单排序失败:", error);
            return false;
        }
    }

    /**
     * 重新均衡所有歌单的排序索引
     * 当排序间隔过小时调用此方法
     */
    static rebalanceSortIndexes(): boolean {
        try {
            const transaction = database.transaction(() => {
                // 获取所有歌单按当前排序
                const selectStmt = database.prepare("SELECT platform, id FROM LocalMusicSheets ORDER BY _sortIndex ASC");
                const sheets = selectStmt.all() as Array<{ platform: string; id: string }>;

                const updateStmt = database.prepare("UPDATE LocalMusicSheets SET _sortIndex = ? WHERE platform = ? AND id = ?");

                // 重新分配排序索引，每个间隔1000
                sheets.forEach((sheet, index) => {
                    const newSortIndex = this.SORT_BASE + (index * this.SORT_INCREMENT);
                    updateStmt.run(newSortIndex, sheet.platform, sheet.id);
                });

                return true;
            });

            return transaction();
        } catch (error) {
            console.error("重新均衡排序索引失败:", error);
            return false;
        }
    }

    /**
     * 获取歌单中的所有歌曲
     * @param platform 歌单平台
     * @param id 歌单ID
     * @param orderBy 排序字段，默认按_sortIndex排序
     * @param order 排序方向
     * @returns 歌曲数组
     */
    static getMusicItemsInSheet(
        platform: string,
        id: string,
        orderBy: string = "_sortIndex",
        order: "ASC" | "DESC" = "ASC",
    ): IDataBaseModel.IMusicItemModel[] {
        try {
            const allowedFields = ["_sortIndex", "title", "artist", "album", "_timestamp"];
            if (!allowedFields.includes(orderBy)) {
                orderBy = "_sortIndex";
            }

            const selectStmt = database.prepare(`
                SELECT * FROM LocalMusicItems 
                WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
                ORDER BY ${orderBy} ${order}
            `);
            const results = selectStmt.all(platform, id) as any[];

            return results.map(result => ({
                platform: result.platform,
                id: result.id,
                artist: result.artist,
                title: result.title,
                duration: result.duration,
                album: result.album,
                artwork: result.artwork,
                _timestamp: result._timestamp,
                _raw: result._raw,
                _sortIndex: result._sortIndex,
                _musicSheetId: result._musicSheetId,
                _musicSheetPlatform: result._musicSheetPlatform,
            }));
        } catch (error) {
            console.error("获取歌单歌曲失败:", error);
            return [];
        }
    }

    /**
     * 获取歌单中歌曲的数量
     * @param platform 歌单平台
     * @param id 歌单ID
     * @returns 歌曲数量
     */
    static getMusicItemCountInSheet(platform: string, id: string): number {
        try {
            const countStmt = database.prepare(`
                SELECT COUNT(*) as count FROM LocalMusicItems 
                WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
            `);
            const result = countStmt.get(platform, id) as { count: number };
            return result.count;
        } catch (error) {
            console.error("获取歌单歌曲数量失败:", error);
            return 0;
        }
    }

    /**
     * 检查歌单是否存在
     * @param platform 平台
     * @param id 歌单ID
     * @returns 是否存在
     */
    static existsMusicSheet(platform: string, id: string): boolean {
        try {
            const countStmt = database.prepare("SELECT COUNT(*) as count FROM LocalMusicSheets WHERE platform = ? AND id = ?");
            const result = countStmt.get(platform, id) as { count: number };
            return result.count > 0;
        } catch (error) {
            console.error("检查歌单是否存在失败:", error);
            return false;
        }
    }

    /**
     * 搜索歌单
     * @param keyword 搜索关键词
     * @param searchFields 搜索字段数组，默认搜索title和artist
     * @returns 匹配的歌单数组
     */
    static searchMusicSheets(
        keyword: string,
        searchFields: string[] = ["title", "artist"],
    ): IDataBaseModel.IMusicSheetModel[] {
        try {
            if (!keyword.trim()) {
                return this.getAllMusicSheets();
            }

            const allowedFields = ["title", "artist", "description"];
            const validFields = searchFields.filter(field => allowedFields.includes(field));

            if (validFields.length === 0) {
                validFields.push("title");
            }

            const whereConditions = validFields.map(field => `${field} LIKE ?`).join(" OR ");
            const searchPattern = `%${keyword}%`;
            const params = validFields.map(() => searchPattern);

            const searchStmt = database.prepare(`
                SELECT * FROM LocalMusicSheets 
                WHERE ${whereConditions}
                ORDER BY _sortIndex ASC
            `);

            const results = searchStmt.all(...params) as any[];

            return results.map(result => ({
                platform: result.platform,
                id: result.id,
                title: result.title,
                artwork: result.artwork,
                description: result.description,
                worksNum: result.worksNum,
                playCount: result.playCount,
                createAt: result.createAt,
                artist: result.artist,
                _raw: result._raw,
                _sortIndex: result._sortIndex,
            }));        
        } catch (error) {
            console.error("搜索歌单失败:", error);
            return [];
        }
    }

    /**
     * 批量移动歌单到指定位置（支持所有拖拽和排序场景）
     * @param selectedSheets 要移动的歌单标识数组
     * @param targetPlatform 目标歌单的平台（null表示移动到开头/末尾）
     * @param targetId 目标歌单的ID（null表示移动到开头/末尾）  
     * @param position 相对于目标歌单的位置："before" | "after"，默认"after"
     * @returns 成功移动的数量
     * 
     * @example
     * // 移动到开头
     * batchMoveMusicSheets(sheets, null, null, "before")
     * 
     * // 移动到末尾  
     * batchMoveMusicSheets(sheets, null, null, "after")
     * 
     * // 移动到指定歌单之前
     * batchMoveMusicSheets(sheets, "platform1", "id1", "before")
     * 
     * // 移动到指定歌单之后
     * batchMoveMusicSheets(sheets, "platform1", "id1", "after")
     */
    static batchMoveMusicSheets(
        selectedSheets: Array<{ platform: string; id: string }>,
        targetPlatform: string | null = null,
        targetId: string | null = null,        position: "before" | "after" = "after",
    ): number {
        if (!selectedSheets.length) return 0;

        try {
            const transaction = database.transaction(() => {
                // 获取所有歌单的排序信息
                const allSheetsStmt = database.prepare(`
                    SELECT platform, id, _sortIndex 
                    FROM LocalMusicSheets 
                    ORDER BY _sortIndex ASC
                `);
                const allSheets = allSheetsStmt.all() as Array<{
                    platform: string;
                    id: string;
                    _sortIndex: number;
                }>;

                // 分离要移动的歌单和剩余的歌单
                const selectedSheetIds = new Set(selectedSheets.map(s => `${s.platform}:${s.id}`));
                const sheetsToMove = allSheets.filter(s => selectedSheetIds.has(`${s.platform}:${s.id}`));
                const remainingSheets = allSheets.filter(s => !selectedSheetIds.has(`${s.platform}:${s.id}`));

                if (!sheetsToMove.length) return 0;

                // 计算插入位置
                let insertIndex = 0;
                if (targetPlatform && targetId) {
                    const targetIndex = remainingSheets.findIndex(s => 
                        s.platform === targetPlatform && s.id === targetId,
                    );
                    insertIndex = targetIndex === -1 ? 0 : 
                        (position === "after" ? targetIndex + 1 : targetIndex);
                } else {
                    insertIndex = position === "before" ? 0 : remainingSheets.length;
                }

                // 构建新的排序数组并重新分配排序索引
                const newOrderedSheets = [...remainingSheets];
                newOrderedSheets.splice(insertIndex, 0, ...sheetsToMove);

                const updateStmt = database.prepare(`
                    UPDATE LocalMusicSheets SET _sortIndex = ? WHERE platform = ? AND id = ?
                `);

                let successCount = 0;
                newOrderedSheets.forEach((sheet, index) => {
                    const newSortIndex = this.SORT_BASE + (index * this.SORT_INCREMENT);
                    try {
                        const result = updateStmt.run(newSortIndex, sheet.platform, sheet.id);
                        if (result.changes > 0 && selectedSheetIds.has(`${sheet.platform}:${sheet.id}`)) {
                            successCount++;
                        }
                    } catch (error) {
                        console.warn(`批量移动歌单失败 (${sheet.platform}:${sheet.id}):`, error);
                    }
                });

                return successCount;
            });

            return transaction();
        } catch (error) {
            console.error("批量移动歌单失败:", error);
            return 0;
        }    
    }
}

// 导出数据库实例和类
export { database, LocalMusicSheetDB };



