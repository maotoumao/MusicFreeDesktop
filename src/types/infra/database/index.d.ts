import type Database from 'better-sqlite3';

/**
 * 数据库提供者接口。
 * 其他 infra 模块通过 setup(dbProvider) 注入此接口来获取 DB 连接。
 */
export interface IDatabaseProvider {
    /** 获取 better-sqlite3 数据库实例 */
    getDatabase(): Database.Database;

    /** 关闭数据库连接。应在应用退出时最后调用。 */
    dispose(): void;
}
