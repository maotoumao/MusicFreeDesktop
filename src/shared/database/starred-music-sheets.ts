import { database } from "./db-init";

const _SORT_BASE = 1000;
const SORT_INCREMENT = 1000;

export function addStarredMusicSheet(musicSheet: IDataBaseModel.IMusicSheetModel): boolean {
    try {
        const insertStmt = database.prepare(`
            INSERT INTO StarredMusicSheets 
            (platform, id, title, artwork, description, worksNum, playCount, createAt, artist, _raw, _sortIndex)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let sortIndex = musicSheet._sortIndex;
        if (sortIndex === undefined || sortIndex === null) {
            const maxSortStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM StarredMusicSheets");
            const result = maxSortStmt.get() as { maxSort: number | null };
            sortIndex = (result.maxSort || 0) + SORT_INCREMENT;
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
    } catch {
        return false;
    }
}

export function batchAddStarredMusicSheets(musicSheets: IDataBaseModel.IMusicSheetModel[]): number {
    if (!musicSheets.length) {
        return 0;
    }

    try {
        const transaction = database.transaction(() => {
            let successCount = 0;

            const maxSortStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM StarredMusicSheets");
            const result = maxSortStmt.get() as { maxSort: number | null };
            let currentMaxSort = result.maxSort || 0;

            const insertStmt = database.prepare(`
                INSERT INTO StarredMusicSheets 
                (platform, id, title, artwork, description, worksNum, playCount, createAt, artist, _raw, _sortIndex)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const sheet of musicSheets) {
                try {
                    let sortIndex = sheet._sortIndex;
                    if (sortIndex === undefined || sortIndex === null) {
                        currentMaxSort += SORT_INCREMENT;
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
                } catch {
                    // 忽略单个添加失败的情况（可能是重复添加）
                }
            }

            return successCount;
        });

        return transaction();
    } catch {
        return 0;
    }
}

export function deleteStarredMusicSheet(platform: string, id: string): boolean {
    try {
        const deleteStmt = database.prepare("DELETE FROM StarredMusicSheets WHERE platform = ? AND id = ?");
        const result = deleteStmt.run(platform, id);
        return result.changes > 0;
    } catch {
        return false;
    }
}

export function batchDeleteStarredMusicSheets(sheets: Array<{ platform: string; id: string }>): number {
    if (!sheets.length) {
        return 0;
    }

    try {
        const transaction = database.transaction(() => {
            let successCount = 0;
            const deleteStmt = database.prepare("DELETE FROM StarredMusicSheets WHERE platform = ? AND id = ?");

            for (const sheet of sheets) {
                try {
                    const result = deleteStmt.run(sheet.platform, sheet.id);
                    if (result.changes > 0) {
                        successCount++;
                    }
                } catch {
                    // 忽略单个删除失败的情况
                }
            }

            return successCount;
        });

        return transaction();
    } catch {
        return 0;
    }
}

export function getStarredMusicSheet(platform: string, id: string): IDataBaseModel.IMusicSheetModel | null {
    try {
        const selectStmt = database.prepare(`
            SELECT * FROM StarredMusicSheets 
            WHERE platform = ? AND id = ?
        `);
        const result = selectStmt.get(platform, id) as any;

        if (!result) {
            return null;
        }

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
    } catch {
        return null;
    }
}

export function getAllStarredMusicSheets(orderBy: string = "_sortIndex", order: "ASC" | "DESC" = "ASC"): IDataBaseModel.IMusicSheetModel[] {
    try {
        const allowedFields = ["_sortIndex", "title", "createAt", "artist", "playCount"];
        if (!allowedFields.includes(orderBy)) {
            orderBy = "_sortIndex";
        }

        const selectStmt = database.prepare(`
            SELECT * FROM StarredMusicSheets 
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
    } catch {
        return [];
    }
}

export function getStarredMusicSheetsByPlatform(platform: string, orderBy: string = "_sortIndex", order: "ASC" | "DESC" = "ASC"): IDataBaseModel.IMusicSheetModel[] {
    try {
        const allowedFields = ["_sortIndex", "title", "createAt", "artist", "playCount"];
        if (!allowedFields.includes(orderBy)) {
            orderBy = "_sortIndex";
        }

        const selectStmt = database.prepare(`
            SELECT * FROM StarredMusicSheets 
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
    } catch {
        return [];
    }
}

export function updateStarredMusicSheet(
    platform: string,
    id: string,
    updates: Partial<Omit<IDataBaseModel.IMusicSheetModel, "platform" | "id">>,
): boolean {
    try {
        if (Object.keys(updates).length === 0) {
            return false;
        }

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
            UPDATE StarredMusicSheets 
            SET ${updateFields.join(", ")} 
            WHERE platform = ? AND id = ?
        `);

        const result = updateStmt.run(...values);
        return result.changes > 0;
    } catch {
        return false;
    }
}

export function searchStarredMusicSheets(
    keyword: string,
    searchFields: string[] = ["title", "artist"],
): IDataBaseModel.IMusicSheetModel[] {
    try {
        if (!keyword.trim()) {
            return getAllStarredMusicSheets();
        }

        const allowedFields = ["title", "artist", "description"];
        const validFields = searchFields.filter(field => allowedFields.includes(field));

        if (validFields.length === 0) {
            validFields.push("title", "artist");
        }

        const whereConditions = validFields.map(field => `${field} LIKE ?`).join(" OR ");
        const searchPattern = `%${keyword}%`;
        const params = validFields.map(() => searchPattern);

        const searchStmt = database.prepare(`
            SELECT * FROM StarredMusicSheets 
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
    } catch {
        return [];
    }
}

export function getStarredMusicSheetCount(): number {
    try {
        const countStmt = database.prepare("SELECT COUNT(*) as count FROM StarredMusicSheets");
        const result = countStmt.get() as { count: number };
        return result.count;
    } catch {
        return 0;
    }
}

export function isStarredMusicSheet(platform: string, id: string): boolean {
    try {
        const countStmt = database.prepare("SELECT COUNT(*) as count FROM StarredMusicSheets WHERE platform = ? AND id = ?");
        const result = countStmt.get(platform, id) as { count: number };
        return result.count > 0;
    } catch {
        return false;
    }
}

export function getStarredMusicSheetsPaginated(options: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    order?: "ASC" | "DESC";
    platform?: string;
} = {}): { items: IDataBaseModel.IMusicSheetModel[]; total: number } {
    try {
        const { page = 1, pageSize = 20, orderBy = "_sortIndex", order = "ASC", platform } = options;

        const allowedFields = ["_sortIndex", "title", "createAt", "artist", "playCount"];
        const finalOrderBy = allowedFields.includes(orderBy) ? orderBy : "_sortIndex";

        const whereClause = platform ? "WHERE platform = ?" : "";
        const whereParams = platform ? [platform] : [];

        const countStmt = database.prepare(`SELECT COUNT(*) as total FROM StarredMusicSheets ${whereClause}`);
        const countResult = countStmt.get(...whereParams) as { total: number };

        const offset = (page - 1) * pageSize;
        const selectStmt = database.prepare(`
            SELECT * FROM StarredMusicSheets 
            ${whereClause}
            ORDER BY ${finalOrderBy} ${order}
            LIMIT ? OFFSET ?
        `);
        const results = selectStmt.all(...whereParams, pageSize, offset) as any[];

        const items = results.map(result => ({
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

        return {
            items,
            total: countResult.total,
        };
    } catch {
        return { items: [], total: 0 };
    }
}

// Basic batch move function - simplified version
export function batchMoveStarredMusicSheets(
    _selectedSheets: Array<{ platform: string; id: string }>,
    _targetPlatform: string | null = null,
    _targetId: string | null = null,
    _position: "before" | "after" = "after",
): number {
    // For now, return 0 as a placeholder - advanced sorting can be added later
    return 0;
}
