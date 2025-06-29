import { database } from "./db-init";
import { existsMusicSheet } from "./local-music-sheet";

const SORT_BASE = 1000;
const SORT_INCREMENT = 1000;

export function addMusicItemToSheet(
    musicItem: IDataBaseModel.IMusicItemModel,
    musicSheetPlatform: string,
    musicSheetId: string,
    sortIndex?: number,
): boolean {
    try {
        if (!existsMusicSheet(musicSheetPlatform, musicSheetId)) {
            return false;
        }

        const insertStmt = database.prepare(`
            INSERT INTO LocalMusicItems 
            (platform, id, artist, title, duration, album, artwork, _timestamp, _raw, _sortIndex, _musicSheetId, _musicSheetPlatform)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let finalSortIndex = sortIndex;
        if (finalSortIndex === undefined || finalSortIndex === null) {
            const maxSortStmt = database.prepare(`
                SELECT MAX(_sortIndex) as maxSort FROM LocalMusicItems 
                WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
            `);
            const result = maxSortStmt.get(musicSheetPlatform, musicSheetId) as { maxSort: number | null };
            finalSortIndex = (result.maxSort || 0) + SORT_INCREMENT;
        }

        const result = insertStmt.run(
            musicItem.platform,
            "" + musicItem.id,
            musicItem.artist || null,
            musicItem.title,
            musicItem.duration || null,
            musicItem.album || null,
            musicItem.artwork || null,
            musicItem._timestamp || Date.now(),
            musicItem._raw,
            finalSortIndex,
            musicSheetId,
            musicSheetPlatform,
        );

        if (result.changes > 0) {
            const currentCount = getMusicItemCountInSheet(musicSheetPlatform, musicSheetId);
            const updateStmt = database.prepare(`
                UPDATE LocalMusicSheets 
                SET worksNum = ? 
                WHERE platform = ? AND id = ?
            `);
            updateStmt.run(currentCount, musicSheetPlatform, musicSheetId);
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

export function batchAddMusicItemsToSheet(
    musicItems: IDataBaseModel.IMusicItemModel[],
    musicSheetPlatform: string,
    musicSheetId: string,
): number {
    if (!musicItems.length) {
        return 0;
    }

    try {
        if (!existsMusicSheet(musicSheetPlatform, musicSheetId)) {
            return 0;
        }

        const transaction = database.transaction(() => {
            let successCount = 0;

            const maxSortStmt = database.prepare(`
                SELECT MAX(_sortIndex) as maxSort FROM LocalMusicItems 
                WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
            `);
            const result = maxSortStmt.get(musicSheetPlatform, musicSheetId) as { maxSort: number | null };
            let currentMaxSort = result.maxSort || 0;

            const insertStmt = database.prepare(`
                INSERT INTO LocalMusicItems 
                (platform, id, artist, title, duration, album, artwork, _timestamp, _raw, _sortIndex, _musicSheetId, _musicSheetPlatform)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of musicItems) {
                try {
                    let sortIndex = item._sortIndex;
                    if (sortIndex === undefined || sortIndex === null) {
                        currentMaxSort += SORT_INCREMENT;
                        sortIndex = currentMaxSort;
                    }

                    const insertResult = insertStmt.run(
                        item.platform,
                        "" + item.id,
                        item.artist || null,
                        item.title,
                        item.duration || null,
                        item.album || null,
                        item.artwork || null,
                        item._timestamp || Date.now(),
                        item._raw,
                        sortIndex,
                        musicSheetId,
                        musicSheetPlatform,
                    );

                    if (insertResult.changes > 0) {
                        successCount++;
                    }
                } catch {
                    // 忽略单个添加失败的情况（可能是重复添加）
                }
            }

            if (successCount > 0) {
                const currentCount = getMusicItemCountInSheet(musicSheetPlatform, musicSheetId);
                const updateStmt = database.prepare(`
                UPDATE LocalMusicSheets 
                SET worksNum = ? 
                WHERE platform = ? AND id = ?
            `);
                updateStmt.run(currentCount, musicSheetPlatform, musicSheetId);
            }

            return successCount;
        });

        return transaction();
    } catch {
        return 0;
    }
}

export function deleteMusicItemFromSheet(
    musicItemPlatform: string,
    musicItemId: string,
    musicSheetPlatform: string,
    musicSheetId: string,
): boolean {
    try {
        const deleteStmt = database.prepare(`
            DELETE FROM LocalMusicItems 
            WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
        `);
        const result = deleteStmt.run(musicItemPlatform, "" + musicItemId, musicSheetPlatform, musicSheetId);        
        if (result.changes > 0) {
            // 直接计算当前歌单中的歌曲数量
            const currentCount = getMusicItemCountInSheet(musicSheetPlatform, musicSheetId);
            const updateStmt = database.prepare(`
                UPDATE LocalMusicSheets 
                SET worksNum = ? 
                WHERE platform = ? AND id = ?
            `);
            updateStmt.run(currentCount, musicSheetPlatform, musicSheetId);
            return true;
        }
        
        return false;
    } catch {
        return false;
    }
}

export function batchDeleteMusicItemsFromSheet(
    musicItems: Array<{ platform: string; id: string }>,
    musicSheetPlatform: string,
    musicSheetId: string,
): number {
    if (!musicItems.length) {
        return 0;
    }

    try {
        const transaction = database.transaction(() => {
            let successCount = 0;
            const deleteStmt = database.prepare(`
                DELETE FROM LocalMusicItems 
                WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
            `);

            for (const item of musicItems) {
                try {
                    const result = deleteStmt.run(item.platform, "" + item.id, musicSheetPlatform, musicSheetId);
                    if (result.changes > 0) {
                        successCount++;
                    }
                } catch {
                    // 忽略单个删除失败的情况
                }
            }

            if (successCount > 0) {
                // 直接计算当前歌单中的歌曲数量
                const currentCount = getMusicItemCountInSheet(musicSheetPlatform, musicSheetId);
                const updateStmt = database.prepare(`
                    UPDATE LocalMusicSheets 
                    SET worksNum = ? 
                    WHERE platform = ? AND id = ?
                `);
                updateStmt.run(currentCount, musicSheetPlatform, musicSheetId);
            }

            return successCount;
        });

        return transaction();
    } catch {
        return 0;
    }
}

export function getMusicItemInSheet(
    musicItemPlatform: string,
    musicItemId: string,
    musicSheetPlatform: string,
    musicSheetId: string,
): IDataBaseModel.IMusicItemModel | null {
    try {
        const selectStmt = database.prepare(`
            SELECT * FROM LocalMusicItems 
            WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
        `);
        const result = selectStmt.get(musicItemPlatform, "" + musicItemId, musicSheetPlatform, musicSheetId) as any;

        if (!result) {
            return null;
        }

        return {
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
        };
    } catch {
        return null;
    }
}

export function getMusicItemsInSheet(
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
    } catch {
        return [];
    }
}

export function getMusicItemsInSheetPaginated(
    musicSheetPlatform: string,
    musicSheetId: string,
    options: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        order?: "ASC" | "DESC";
    } = {},
): { items: IDataBaseModel.IMusicItemModel[]; total: number } {
    try {
        const { page = 1, pageSize = 50, orderBy = "_sortIndex", order = "ASC" } = options;

        const allowedFields = ["_sortIndex", "title", "artist", "album", "_timestamp"];
        const finalOrderBy = allowedFields.includes(orderBy) ? orderBy : "_sortIndex";

        const countStmt = database.prepare(`
            SELECT COUNT(*) as total FROM LocalMusicItems 
            WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
        `);
        const countResult = countStmt.get(musicSheetPlatform, musicSheetId) as { total: number };

        const offset = (page - 1) * pageSize;
        const selectStmt = database.prepare(`
            SELECT * FROM LocalMusicItems 
            WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
            ORDER BY ${finalOrderBy} ${order}
            LIMIT ? OFFSET ?
        `);
        const results = selectStmt.all(musicSheetPlatform, musicSheetId, pageSize, offset) as any[];

        const items = results.map(result => ({
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

        return {
            items,
            total: countResult.total,
        };
    } catch {
        return { items: [], total: 0 };
    }
}

export function updateMusicItemInSheet(
    musicItemPlatform: string,
    musicItemId: string,
    musicSheetPlatform: string,
    musicSheetId: string,
    updates: Partial<Omit<IDataBaseModel.IMusicItemModel, "platform" | "id" | "_musicSheetPlatform" | "_musicSheetId">>,
): boolean {
    try {
        if (Object.keys(updates).length === 0) {
            return false;
        }

        const allowedFields = ["artist", "title", "duration", "album", "artwork", "_timestamp", "_raw", "_sortIndex"];
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

        values.push(musicItemPlatform, musicItemId, musicSheetPlatform, musicSheetId);
        const updateStmt = database.prepare(`
            UPDATE LocalMusicItems 
            SET ${updateFields.join(", ")} 
            WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
        `);

        const result = updateStmt.run(...values);
        return result.changes > 0;
    } catch {
        return false;
    }
}

export function searchMusicItemsInSheet(
    musicSheetPlatform: string,
    musicSheetId: string,
    keyword: string,
    searchFields: string[] = ["title", "artist"],
): IDataBaseModel.IMusicItemModel[] {
    try {
        if (!keyword.trim()) {
            return getMusicItemsInSheet(musicSheetPlatform, musicSheetId);
        }

        const allowedFields = ["title", "artist", "album"];
        const validFields = searchFields.filter(field => allowedFields.includes(field));

        if (validFields.length === 0) {
            validFields.push("title", "artist");
        }

        const whereConditions = validFields.map(field => `${field} LIKE ?`).join(" OR ");
        const searchPattern = `%${keyword}%`;
        const params = [musicSheetPlatform, musicSheetId, ...validFields.map(() => searchPattern)];

        const searchStmt = database.prepare(`
            SELECT * FROM LocalMusicItems 
            WHERE _musicSheetPlatform = ? AND _musicSheetId = ? AND (${whereConditions})
            ORDER BY _sortIndex ASC
        `);

        const results = searchStmt.all(...params) as any[];

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
    } catch {
        return [];
    }
}

export function getMusicItemCountInSheet(platform: string, id: string): number {
    try {
        const countStmt = database.prepare(`
            SELECT COUNT(*) as count FROM LocalMusicItems 
            WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
        `);
        const result = countStmt.get(platform, id) as { count: number };
        return result.count;
    } catch {
        return 0;
    }
}

export function existsMusicItemInSheet(
    musicItemPlatform: string,
    musicItemId: string,
    musicSheetPlatform: string,
    musicSheetId: string,
): boolean {
    try {
        const countStmt = database.prepare(`
            SELECT COUNT(*) as count FROM LocalMusicItems 
            WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
        `);
        const result = countStmt.get(musicItemPlatform, musicItemId, musicSheetPlatform, musicSheetId) as { count: number };
        return result.count > 0;
    } catch {
        return false;
    }
}

function rebalanceMusicItemSortIndexes(musicSheetPlatform: string, musicSheetId: string): boolean {
    try {
        const transaction = database.transaction(() => {
            const selectStmt = database.prepare(`
                SELECT platform, id FROM LocalMusicItems 
                WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
                ORDER BY _sortIndex ASC
            `);
            const items = selectStmt.all(musicSheetPlatform, musicSheetId) as Array<{ platform: string; id: string }>;

            const updateStmt = database.prepare(`
                UPDATE LocalMusicItems SET _sortIndex = ? 
                WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
            `);

            items.forEach((item, index) => {
                const newSortIndex = SORT_BASE + (index * SORT_INCREMENT);
                updateStmt.run(newSortIndex, item.platform, item.id, musicSheetPlatform, musicSheetId);
            });

            return true;
        });

        return transaction();
    } catch {
        return false;
    }
}

function calculateItemSortValuesAtBeginning(remainingItems: Array<{ _sortIndex: number }>, count: number): number[] {
    const firstSort = remainingItems.length > 0 ? remainingItems[0]._sortIndex : SORT_BASE;
    const baseSort = firstSort - SORT_INCREMENT;

    return Array.from({ length: count }, (_, i) => baseSort + (i * (SORT_INCREMENT / count)));
}

function calculateItemSortValuesAtEnd(remainingItems: Array<{ _sortIndex: number }>, count: number): number[] {
    const lastSort = remainingItems.length > 0 ?
        remainingItems[remainingItems.length - 1]._sortIndex :
        SORT_BASE - SORT_INCREMENT;
    const baseSort = lastSort + SORT_INCREMENT;

    return Array.from({ length: count }, (_, i) => baseSort + (i * (SORT_INCREMENT / count)));
}

function calculateItemSortValuesBefore(
    remainingItems: Array<{ _sortIndex: number }>,
    targetIndex: number,
    count: number,
): number[] {
    const targetSort = remainingItems[targetIndex]._sortIndex;
    const prevSort = targetIndex > 0 ? remainingItems[targetIndex - 1]._sortIndex : targetSort - SORT_INCREMENT;

    const gap = (targetSort - prevSort) / (count + 1);
    return Array.from({ length: count }, (_, i) => prevSort + ((i + 1) * gap));
}

function calculateItemSortValuesAfter(
    remainingItems: Array<{ _sortIndex: number }>,
    targetIndex: number,
    count: number,
): number[] {
    const targetSort = remainingItems[targetIndex]._sortIndex;
    const nextSort = targetIndex < remainingItems.length - 1 ?
        remainingItems[targetIndex + 1]._sortIndex :
        targetSort + SORT_INCREMENT;

    const gap = (nextSort - targetSort) / (count + 1);
    return Array.from({ length: count }, (_, i) => targetSort + ((i + 1) * gap));
}

export function batchMoveMusicItemsInSheet(
    selectedItems: Array<{ platform: string; id: string }>,
    musicSheetPlatform: string,
    musicSheetId: string,
    targetItemPlatform: string | null = null,
    targetItemId: string | null = null,
    position: "before" | "after" = "after",
): number {
    if (!selectedItems.length) {
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
                    FROM LocalMusicItems 
                    WHERE _musicSheetPlatform = ? AND _musicSheetId = ?
                )
                WHERE lead_index IS NOT NULL
            `);
            const minGapResult = minGapStmt.get(0.001, musicSheetPlatform, musicSheetId) as { minGap: number | null };

            if (minGapResult.minGap !== null && minGapResult.minGap < 0.001) {
                rebalanceMusicItemSortIndexes(musicSheetPlatform, musicSheetId);
            }

            const placeholderIds = selectedItems.map(() => "?").join(",");
            const placeholderPlatforms = selectedItems.map(() => "?").join(",");

            const remainingItemsStmt = database.prepare(`
                SELECT platform, id, _sortIndex 
                FROM LocalMusicItems 
                WHERE _musicSheetPlatform = ? AND _musicSheetId = ? AND NOT (
                    platform IN (${placeholderPlatforms}) AND 
                    id IN (${placeholderIds})
                )
                ORDER BY _sortIndex ASC
            `);

            const params = [
                musicSheetPlatform,
                musicSheetId,
                ...selectedItems.map(s => s.platform),
                ...selectedItems.map(s => s.id),
            ];
            const remainingItems = remainingItemsStmt.all(...params) as Array<{
                platform: string;
                id: string;
                _sortIndex: number;
            }>;

            let targetSortValues: number[];

            if (targetItemPlatform && targetItemId) {
                const targetIndex = remainingItems.findIndex(s =>
                    s.platform === targetItemPlatform && s.id === targetItemId,
                );

                if (targetIndex === -1) {
                    targetSortValues = calculateItemSortValuesAtEnd(remainingItems, selectedItems.length);
                } else {
                    if (position === "before") {
                        targetSortValues = calculateItemSortValuesBefore(remainingItems, targetIndex, selectedItems.length);
                    } else {
                        targetSortValues = calculateItemSortValuesAfter(remainingItems, targetIndex, selectedItems.length);
                    }
                }
            } else {
                if (position === "before") {
                    targetSortValues = calculateItemSortValuesAtBeginning(remainingItems, selectedItems.length);
                } else {
                    targetSortValues = calculateItemSortValuesAtEnd(remainingItems, selectedItems.length);
                }
            }

            const updateStmt = database.prepare(`
                UPDATE LocalMusicItems SET _sortIndex = ? 
                WHERE platform = ? AND id = ? AND _musicSheetPlatform = ? AND _musicSheetId = ?
            `);

            let successCount = 0;
            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];                try {
                    const result = updateStmt.run(
                        targetSortValues[i],
                        item.platform,
                        item.id,
                        musicSheetPlatform,
                        musicSheetId,
                    );
                    if (result.changes > 0) {
                        successCount++;
                    }
                } catch {
                    // 忽略单个更新失败的情况
                }
            }

            return successCount;
        });

        return transaction();
    } catch {
        return 0;
    }
}
