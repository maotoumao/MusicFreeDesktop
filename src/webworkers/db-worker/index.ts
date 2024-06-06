import * as Comlink from "comlink";
import * as chokidar from "chokidar";
import path from "path";
import { supportLocalMediaType } from "@/common/constant";
import debounce from "lodash.debounce";
import { parseLocalMusicItem } from "@/common/file-util";
import { setInternalData } from "@/common/media-util";
import { safeParse } from "@/common/safe-serialization";
import Database from "better-sqlite3";

let database: Database.Database;

function setupWorker(dbPath: string) {
  database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
}

Comlink.expose({});
