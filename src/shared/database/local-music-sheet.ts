import { database } from "./db-init";

const SORT_BASE = 1000;
const SORT_INCREMENT = 1000;

export function addMusicSheet(musicSheet: Omit<IDataBaseModel.IMusicSheetModel, "_sortIndex">): boolean {
    try {
        console.log("Adding music sheet:", musicSheet);
        const insertStmt = database.prepare(`
            INSERT INTO LocalMusicSheets 
            (platform, id, title, artwork, description, worksNum, playCount, createAt, artist, _raw, _sortIndex)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const maxSortStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM LocalMusicSheets");
        const sortResult = maxSortStmt.get() as { maxSort: number | null };
        const sortIndex = (sortResult.maxSort || 0) + SORT_INCREMENT;

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

export function batchAddMusicSheets(musicSheets: IDataBaseModel.IMusicSheetModel[]): number {
    if (!musicSheets.length) {
        return 0;
    }

    try {
        const transaction = database.transaction(() => {
            let successCount = 0;

            const maxSortStmt = database.prepare("SELECT MAX(_sortIndex) as maxSort FROM LocalMusicSheets");
            const sortResult = maxSortStmt.get() as { maxSort: number | null };
            let currentMaxSort = sortResult.maxSort || 0;

            const insertStmt = database.prepare(`
                INSERT INTO LocalMusicSheets 
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

export function deleteMusicSheet(platform: string, id: string): boolean {
    try {
        const deleteStmt = database.prepare("DELETE FROM LocalMusicSheets WHERE platform = ? AND id = ?");
        const result = deleteStmt.run(platform, id);
        return result.changes > 0;
    } catch {
        return false;
    }
}

export function batchDeleteMusicSheets(sheets: Array<{ platform: string; id: string }>): number {
    if (!sheets.length) {
        return 0;
    }

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

export function getMusicSheet(platform: string, id: string): IDataBaseModel.IMusicSheetModel | null {
    try {
        const selectStmt = database.prepare(`
            SELECT * FROM LocalMusicSheets 
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

export function getAllMusicSheets(orderBy: string = "_sortIndex", order: "ASC" | "DESC" = "ASC"): IDataBaseModel.IMusicSheetModel[] {
    try {
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
    } catch {
        return [];
    }
}

export function getMusicSheetsByPlatform(platform: string, orderBy: string = "_sortIndex", order: "ASC" | "DESC" = "ASC"): IDataBaseModel.IMusicSheetModel[] {
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
    } catch {
        return [];
    }
}

export function updateMusicSheet(
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
            UPDATE LocalMusicSheets 
            SET ${updateFields.join(", ")} 
            WHERE platform = ? AND id = ?
        `);

        const result = updateStmt.run(...values);
        return result.changes > 0;
    } catch {
        return false;
    }
}

export function clearAllMusicItemsInSheet(
    musicSheetPlatform: string,
    musicSheetId: string,
): number {
    try {
        const deleteStmt = database.prepare(`
            DELETE FROM LocalMusicItems 
            WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
        `);
        const result = deleteStmt.run(musicSheetPlatform, musicSheetId);
        return result.changes;
    } catch {
        return 0;
    }
}

export function existsMusicSheet(platform: string, id: string): boolean {
    try {
        const countStmt = database.prepare("SELECT COUNT(*) as count FROM LocalMusicSheets WHERE platform = ? AND id = ?");
        const result = countStmt.get(platform, id) as { count: number };
        return result.count > 0;
    } catch {
        return false;
    }
}

export function searchMusicSheets(
    keyword: string,
    searchFields: string[] = ["title", "artist"],
): IDataBaseModel.IMusicSheetModel[] {
    try {
        if (!keyword.trim()) {
            return getAllMusicSheets();
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
    } catch {
        return [];
    }
}

export function getMusicSheetCount(): number {
    try {
        const countStmt = database.prepare("SELECT COUNT(*) as count FROM LocalMusicSheets");
        const result = countStmt.get() as { count: number };
        return result.count;
    } catch {
        return 0;
    }
}

function rebalanceSortIndexes(): boolean {
    try {
        const transaction = database.transaction(() => {
            const selectStmt = database.prepare("SELECT platform, id FROM LocalMusicSheets ORDER BY _sortIndex ASC");
            const sheets = selectStmt.all() as Array<{ platform: string; id: string }>;

            const updateStmt = database.prepare("UPDATE LocalMusicSheets SET _sortIndex = ? WHERE platform = ? AND id = ?");

            sheets.forEach((sheet, index) => {
                const newSortIndex = SORT_BASE + (index * SORT_INCREMENT);
                updateStmt.run(newSortIndex, sheet.platform, sheet.id);
            });

            return true;
        });

        return transaction();
    } catch {
        return false;
    }
}

function calculateSortValuesAtBeginning(remainingSheets: Array<{ _sortIndex: number }>, count: number): number[] {
    const firstSort = remainingSheets.length > 0 ? remainingSheets[0]._sortIndex : SORT_BASE;
    const baseSort = firstSort - SORT_INCREMENT;

    return Array.from({ length: count }, (_, i) => baseSort + (i * (SORT_INCREMENT / count)));
}

function calculateSortValuesAtEnd(remainingSheets: Array<{ _sortIndex: number }>, count: number): number[] {
    const lastSort = remainingSheets.length > 0 ?
        remainingSheets[remainingSheets.length - 1]._sortIndex :
        SORT_BASE - SORT_INCREMENT;
    const baseSort = lastSort + SORT_INCREMENT;

    return Array.from({ length: count }, (_, i) => baseSort + (i * (SORT_INCREMENT / count)));
}

function calculateSortValuesBefore(
    remainingSheets: Array<{ _sortIndex: number }>,
    targetIndex: number,
    count: number,
): number[] {
    const targetSort = remainingSheets[targetIndex]._sortIndex;
    const prevSort = targetIndex > 0 ? remainingSheets[targetIndex - 1]._sortIndex : targetSort - SORT_INCREMENT;

    const gap = (targetSort - prevSort) / (count + 1);
    return Array.from({ length: count }, (_, i) => prevSort + ((i + 1) * gap));
}

function calculateSortValuesAfter(
    remainingSheets: Array<{ _sortIndex: number }>,
    targetIndex: number,
    count: number,
): number[] {
    const targetSort = remainingSheets[targetIndex]._sortIndex;
    const nextSort = targetIndex < remainingSheets.length - 1 ?
        remainingSheets[targetIndex + 1]._sortIndex :
        targetSort + SORT_INCREMENT;

    const gap = (nextSort - targetSort) / (count + 1);
    return Array.from({ length: count }, (_, i) => targetSort + ((i + 1) * gap));
}

export function batchMoveMusicSheets(
    selectedSheets: Array<{ platform: string; id: string }>,
    targetPlatform: string | null = null,
    targetId: string | null = null,
    position: "before" | "after" = "after",
): number {
    if (!selectedSheets.length) {
        return 0;
    }

    try {
        const transaction = database.transaction(() => {
            const minGapStmt = database.prepare(`
                SELECT MIN(
                    CASE 
                        WHEN lead_index - _sortIndex < ? THEN lead_index - _sortIndex 
                        ELSE NULL 
                    END
                ) as minGap
                FROM (
                    SELECT _sortIndex, 
                           LEAD(_sortIndex) OVER (ORDER BY _sortIndex) as lead_index
                    FROM LocalMusicSheets
                )
                WHERE lead_index IS NOT NULL
            `);
            const minGapResult = minGapStmt.get(0.001) as { minGap: number | null };

            if (minGapResult.minGap !== null && minGapResult.minGap < 0.001) {
                rebalanceSortIndexes();
            }

            const placeholderIds = selectedSheets.map(() => "?").join(",");
            const placeholderPlatforms = selectedSheets.map(() => "?").join(",");

            const remainingSheetsStmt = database.prepare(`
                SELECT platform, id, _sortIndex 
                FROM LocalMusicSheets 
                WHERE NOT (
                    platform IN (${placeholderPlatforms}) AND 
                    id IN (${placeholderIds})
                )
                ORDER BY _sortIndex ASC
            `);

            const params = [...selectedSheets.map(s => s.platform), ...selectedSheets.map(s => s.id)];
            const remainingSheets = remainingSheetsStmt.all(...params) as Array<{
                platform: string;
                id: string;
                _sortIndex: number;
            }>;

            let targetSortValues: number[];

            if (targetPlatform && targetId) {
                const targetIndex = remainingSheets.findIndex(s =>
                    s.platform === targetPlatform && s.id === targetId,
                );

                if (targetIndex === -1) {
                    targetSortValues = calculateSortValuesAtEnd(remainingSheets, selectedSheets.length);
                } else {
                    if (position === "before") {
                        targetSortValues = calculateSortValuesBefore(remainingSheets, targetIndex, selectedSheets.length);
                    } else {
                        targetSortValues = calculateSortValuesAfter(remainingSheets, targetIndex, selectedSheets.length);
                    }
                }
            } else {
                if (position === "before") {
                    targetSortValues = calculateSortValuesAtBeginning(remainingSheets, selectedSheets.length);
                } else {
                    targetSortValues = calculateSortValuesAtEnd(remainingSheets, selectedSheets.length);
                }
            }

            const updateStmt = database.prepare(`
                UPDATE LocalMusicSheets SET _sortIndex = ? WHERE platform = ? AND id = ?
            `);

            let successCount = 0;
            for (let i = 0; i < selectedSheets.length; i++) {
                const sheet = selectedSheets[i];
                try {
                    const result = updateStmt.run(targetSortValues[i], sheet.platform, sheet.id);
                    if (result.changes > 0) {
                        successCount++;
                    }
                } catch {
                    // 静默处理单个歌单移动失败的情况
                }
            }

            return successCount;
        });

        return transaction();
    } catch {
        return 0;
    }
}
