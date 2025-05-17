// src/types/node-mpv.d.ts

declare module 'node-mpv' {
  export interface MpvOptions {
    binary?: string | null;
    socket?: string;
    debug?: boolean;
    verbose?: boolean;
    audio_only?: boolean;
    time_update?: number;
    // observeAllProperties?: boolean; // 此选项在 jeffvli 的 fork 中似乎不存在
    [key: string]: any;
  }

  // status 事件的结构 (node-mpv v2)
  export interface Status {
    property: string;
    value: any;
    // 为了兼容，也保留旧的可能属性，但优先使用 property/value
    'time-pos'?: number;
    duration?: number;
    pause?: boolean;
    volume?: number;
    speed?: number;
    'playback-speed'?: number;
    [key: string]: any;
  }

  export interface EndFileEvent {
    reason: 'eof' | 'stop' | 'error' | 'quit' | 'unknown' | string; // node-mpv v2 中 endfile 事件似乎不存在，但保留以防万一
    error?: number; // MPV 自身的错误码
    [key: string]: any;
  }

  // Chapter 接口定义，基于 jeffvli 的 index.d.ts
  interface Chapter {
    title?: string;
    time?: number;
  }


  class MpvAPI {
    constructor(options?: MpvOptions | Record<string, any>, additionalArgs?: string[]);
    start(): Promise<void>;
    quit(): Promise<void>;
    load(filePath: string, mode?: 'replace' | 'append' | 'append-play', options?: string[]): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>; // jeffvli 的 fork 有 resume 方法
    stop(): Promise<void>;
    // jeffvli 的 fork 中 seek mode 参数可能与原版不同，这里列出一些常见的
    seek(timeSeconds: number, mode?: 'relative' | 'absolute' | 'absolute-percent' | 'relative-percent' | 'keyframes' | 'exact'): Promise<void>;
    volume(level: number): Promise<void>; // 0-100
    speed(factor: number): Promise<void>; // jeffvli 的 fork 有 speed 方法
    setProperty(property: string, value: any): Promise<void>;
    getProperty(property: string): Promise<any>;
    observeProperty(property: string): Promise<void>; // v2 API 只接受一个参数
    unobserveProperty(property: string): Promise<void>; // v2 API 通过属性名取消观察
    
    getDuration(): Promise<number | null>; // jeffvli 的 fork 返回 Promise<number>，但可能是 null
    getTimePosition(): Promise<number>;    // jeffvli 的 fork 返回 Promise<number>
    
    // isRunning 在 jeffvli 的 fork 中是方法
    isRunning(): boolean;

    // 基于 jeffvli 的 index.d.ts 添加/调整的方法
    getChapterCount(): Promise<number>;
    getChapter(index: number): Promise<Chapter>;
    getChapters(): Promise<Chapter[]>;
    loop(times?: number | "inf" | "no"): Promise<void>; // 根据 jeffvli 的 fork 调整
    // ... 其他在 jeffvli fork 中但你的应用可能没用到的方法可以按需添加

    // 事件监听器
    on(event: 'status', listener: (status: Status) => void): this; // v2 使用 'status'
    on(event: 'paused', listener: () => void): this;
    on(event: 'resumed', listener: () => void): this;
    on(event: 'timeposition', listener: (seconds: number) => void): this; // node-mpv v2 的时间更新事件
    on(event: 'stopped', listener: () => void): this;
    on(event: 'started', listener: () => void): this; // 'started' 表示新文件开始播放
    // on(event: 'endfile', listener: (event: EndFileEvent) => void): this; // 不确定 jeffvli fork 中是否有此事件，MPV本身有
    on(event: 'error', listener: (error: Error) => void): this; // 通常是 node-mpv 内部错误
    on(event: 'crashed', listener: () => void): this; // jeffvli 的 fork 的 'crashed' 事件不带 exitCode
    on(event: 'seek', listener: (data: {start: number, end: number}) => void): this; // 'seek' 事件提供 seek 开始和结束的时间
    // on(event: 'playbackrestart', listener: () => void): this; // 当播放从暂停或跳转后恢复时触发

    on(event: string, listener: (...args: any[]) => void): this; // 通用事件监听
    removeAllListeners(event?: string): this;
  }

  export default MpvAPI;
}