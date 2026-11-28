import { LogLevel } from '@common/constant';

export type { LogLevel };

export interface ILogEntry {
    /** 日志级别 */
    level: LogLevel;
    /** 时间戳 ISO 格式 */
    timestamp: string;
    /** 日志来源（如 main / renderer） */
    source: string;
    /** 日志内容 */
    messages: any[];
}

export interface ILogger {
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    /** info 的别名 */
    log(...args: any[]): void;
}
