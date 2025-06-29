import path from "node:path";
import Database from "better-sqlite3";
import { getGlobalContext } from "../global-context/preload";
import fs from "fs";

const appDbPath = path.resolve(getGlobalContext().appPath.userData, "./app-database/database.db");

if (!fs.existsSync(path.dirname(appDbPath))) {
    fs.mkdirSync(path.dirname(appDbPath), { recursive: true });
}

export const database = new Database(appDbPath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.pragma("synchronous = NORMAL");

const DATABASE_LATEST_VERSION = 1;

function createInitialTables() {
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
            _raw TEXT,
            _sortIndex REAL,
            
            PRIMARY KEY (platform, id)
        );
    `);

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
            _raw TEXT,
            _sortIndex REAL,
            _musicSheetId TEXT NOT NULL,
            _musicSheetPlatform TEXT NOT NULL,
            
            UNIQUE (_musicSheetPlatform, _musicSheetId, platform, id),
            
            FOREIGN KEY (_musicSheetPlatform, _musicSheetId)
            REFERENCES LocalMusicSheets(platform, id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        );
    `);

    database.exec("CREATE INDEX IF NOT EXISTS idx_items_coreid ON LocalMusicItems(platform, id)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_items_sheet ON LocalMusicItems(_musicSheetPlatform, _musicSheetId)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_sheets_platform ON LocalMusicSheets(platform)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_items_artist ON LocalMusicItems(artist)");
    database.exec("CREATE INDEX IF NOT EXISTS idx_sheets_sort ON LocalMusicSheets(_sortIndex)");

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
            _raw TEXT,
            _sortIndex REAL,
            
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

    const upgrade = database.transaction(() => {
        for (let version = currentVersion + 1; version <= DATABASE_LATEST_VERSION; version++) {
            switch (version) {
                case 1:
                    createInitialTables();
                    break;
                default:
                    throw new Error(`Unknown database version: ${version}`);
            }
            database.pragma(`user_version = ${version}`);
        }
    });

    upgrade();
}

migrateDatabase();
