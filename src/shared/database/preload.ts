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

// 初始化数据库
function setupDatabase() {
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
            platform TEXT NOT NULL,
            id TEXT NOT NULL,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            duration REAL,
            album TEXT,
            artwork TEXT,
            _raw TEXT NOT NULL,        -- 替代 $$raw
            _sortOrder REAL,
            _musicSheetId TEXT NOT NULL,    -- 替代 $$musicSheetId
            _musicSheetPlatform TEXT NOT NULL, -- 替代 $$musicSheetPlatform
            
            -- 联合主键
            PRIMARY KEY (platform, id),
            
            -- 外键引用歌单表的联合主键
            FOREIGN KEY (_musicSheetPlatform, _musicSheetId)
            REFERENCES LocalMusicSheets(platform, id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        );
    `);

    // 创建索引优化查询性能
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
            _sortIndex INTEGER DEFAULT 0, -- $$sortIndex
            
            -- 联合主键
            PRIMARY KEY (platform, id)
        );
    `);
}

setupDatabase();


