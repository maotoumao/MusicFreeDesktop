/**
 * logger — 主进程层
 *
 * 职责：
 * - 统一日志落盘（双缓冲 + 定时刷新）
 * - 自动日志轮转（按大小分割，保留历史文件）
 * - 接收渲染进程通过 IPC 发送的日志条目
 */
import path from 'path';
import fsp from 'fs/promises';
import { ipcMain } from 'electron';
import type { ILogger, ILogEntry } from '@appTypes/infra/logger';
import { LogLevel } from '@common/constant';
import { safeStringify } from '@common/safeSerialize';
import { IPC } from './common/constant';

/** 单个日志文件最大体积（字节），默认 5MB */
const MAX_LOG_SIZE = 5 * 1024 * 1024;
/** 最多保留的历史日志文件数量 */
const MAX_LOG_FILES = 5;
/** 写入缓冲刷新间隔（ms） */
const FLUSH_INTERVAL = 2000;

/** 静态映射：避免每次 appendLog 做链式三元查找 */
const consoleFnMap: Record<LogLevel, (...args: any[]) => void> = {
    [LogLevel.Debug]: console.debug,
    [LogLevel.Info]: console.log,
    [LogLevel.Warn]: console.warn,
    [LogLevel.Error]: console.error,
};

class Logger implements ILogger {
    private logDir: string;
    private currentLogPath: string;
    /** 双缓冲：写入侧始终 push 到 activeBuffer，flush 时原子交换 */
    private activeBuffer: string[] = [];
    /** 当前文件已写入的估算字节数，避免每次 flush 都 stat */
    private currentFileSize = 0;
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private flushing = false;
    private isSetup = false;

    // ---------- public API ----------

    public async setup() {
        if (this.isSetup) {
            return;
        }

        this.logDir = path.resolve(globalContext.appPath.userData, 'logs');
        await this.ensureLogDir();
        this.currentLogPath = this.buildLogFileName();

        // 尝试获取已有文件大小以续写
        try {
            const stat = await fsp.stat(this.currentLogPath);
            this.currentFileSize = stat.size;
        } catch {
            this.currentFileSize = 0;
        }

        // 定时刷新缓冲区
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, FLUSH_INTERVAL);

        // 注册 IPC：renderer → main（单向，非阻塞）
        ipcMain.on(IPC.LOG, (_evt, entry: ILogEntry) => {
            this.writeEntry(entry);
        });

        this.isSetup = true;
        this.info('[Logger] Logger initialized', { logDir: this.logDir });
    }

    public debug(...args: any[]): void {
        this.appendLog(LogLevel.Debug, 'main', args);
    }

    public info(...args: any[]): void {
        this.appendLog(LogLevel.Info, 'main', args);
    }

    public warn(...args: any[]): void {
        this.appendLog(LogLevel.Warn, 'main', args);
    }

    public error(...args: any[]): void {
        this.appendLog(LogLevel.Error, 'main', args);
    }

    public log(...args: any[]): void {
        this.info(...args);
    }

    public async dispose() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }

    // ---------- internal ----------

    private appendLog(level: LogLevel, source: string, messages: any[]) {
        const timestamp = new Date().toISOString();
        // 直接拼接格式化行，跳过中间 ILogEntry 对象分配
        const line = this.formatLine(timestamp, source, level, messages);
        this.activeBuffer.push(line);

        // 同时输出到控制台便于开发调试
        consoleFnMap[level](`[${timestamp}] [${source}] [${level.toUpperCase()}]`, ...messages);
    }

    /** 将来自 renderer 的已结构化条目推入缓冲区 */
    private writeEntry(entry: ILogEntry) {
        this.activeBuffer.push(
            this.formatLine(entry.timestamp, entry.source, entry.level, entry.messages),
        );
    }

    /** 纯字符串拼接，零中间对象 */
    private formatLine(
        timestamp: string,
        source: string,
        level: LogLevel | string,
        messages: any[],
    ): string {
        // 用 for 循环手动拼接，避免 map + join 产生临时数组
        let msg = '';
        for (let i = 0, len = messages.length; i < len; i++) {
            if (i > 0) msg += ' ';
            msg += safeStringify(messages[i]);
        }
        return `[${timestamp}] [${source}] [${(level as string).toUpperCase()}] ${msg}\n`;
    }

    /** 将缓冲区内容写入文件 */
    private async flush() {
        // 防止并发 flush（定时器 + dispose 可能同时触发）
        if (this.flushing || this.activeBuffer.length === 0) {
            return;
        }
        this.flushing = true;

        // 原子交换缓冲区：O(1)，新日志继续写入新数组
        const lines = this.activeBuffer;
        this.activeBuffer = [];

        const content = lines.join('');
        const contentByteLen = Buffer.byteLength(content, 'utf-8');

        try {
            // 判断是否需要轮转（基于内存缓存的文件大小）
            if (this.currentFileSize + contentByteLen >= MAX_LOG_SIZE) {
                this.currentLogPath = this.buildLogFileName();
                this.currentFileSize = 0;
                // 异步清理旧日志，不阻塞当前写入
                void this.cleanOldLogs();
            }

            await fsp.appendFile(this.currentLogPath, content, 'utf-8');
            this.currentFileSize += contentByteLen;
        } catch (e) {
            console.error('[Logger] Failed to write log file', e);
        } finally {
            this.flushing = false;
        }
    }

    /** 清理超过数量限制的旧日志 */
    private async cleanOldLogs() {
        try {
            const files = await fsp.readdir(this.logDir);
            const logFiles = files
                .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
                .sort()
                .reverse();

            // 并发删除，加速清理
            const toDelete = logFiles.slice(MAX_LOG_FILES);
            if (toDelete.length > 0) {
                await Promise.all(
                    toDelete.map((f) => fsp.rm(path.join(this.logDir, f), { force: true })),
                );
            }
        } catch {
            // ignore
        }
    }

    private buildLogFileName(): string {
        const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return path.join(this.logDir, `app-${date}.log`);
    }

    private async ensureLogDir() {
        try {
            const stat = await fsp.stat(this.logDir);
            if (!stat.isDirectory()) {
                await fsp.rm(this.logDir, { recursive: true, force: true });
                throw new Error('Not a directory');
            }
        } catch {
            await fsp.mkdir(this.logDir, { recursive: true });
        }
    }
}

const logger = new Logger();
export default logger;
