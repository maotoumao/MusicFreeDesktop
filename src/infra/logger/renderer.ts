/**
 * logger — 渲染进程层
 *
 * 职责：
 * - 提供统一的日志 API（debug/info/warn/error）
 * - 控制台输出 + 序列化后通过 IPC 发送到主进程落盘
 */
import type { ILogger, ILogEntry } from '@appTypes/infra/logger';
import { LogLevel } from '@common/constant';
import { safeStringify } from '@common/safeSerialize';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

interface IMod {
    log(entry: ILogEntry): void;
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

/** 静态映射：避免每次调用做链式查找 */
const consoleFnMap: Record<LogLevel, (...args: any[]) => void> = {
    [LogLevel.Debug]: console.debug,
    [LogLevel.Info]: console.log,
    [LogLevel.Warn]: console.warn,
    [LogLevel.Error]: console.error,
};

class Logger implements ILogger {
    public debug(...args: any[]): void {
        this.send(LogLevel.Debug, args);
    }

    public info(...args: any[]): void {
        this.send(LogLevel.Info, args);
    }

    public warn(...args: any[]): void {
        this.send(LogLevel.Warn, args);
    }

    public error(...args: any[]): void {
        this.send(LogLevel.Error, args);
    }

    public log(...args: any[]): void {
        this.info(...args);
    }

    private send(level: LogLevel, messages: any[]) {
        // 控制台输出（保持原始对象便于 DevTools 展开查看）
        consoleFnMap[level]('[renderer] [' + level.toUpperCase() + ']', ...messages);

        // 序列化后通过 IPC 发送到 main 进程落盘
        // 用 for 循环避免 map 产生临时数组
        const serialized: string[] = new Array(messages.length);
        for (let i = 0, len = messages.length; i < len; i++) {
            serialized[i] = safeStringify(messages[i]);
        }

        const entry: ILogEntry = {
            level,
            timestamp: new Date().toISOString(),
            source: 'renderer',
            messages: serialized,
        };

        try {
            mod.log(entry);
        } catch {
            // preload 尚未就绪或通信失败，仅保留控制台输出
        }
    }
}

const logger = new Logger();
export default logger;
