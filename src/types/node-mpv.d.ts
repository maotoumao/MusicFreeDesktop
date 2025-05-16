// src/types/node-mpv.d.ts

declare module 'node-mpv' {
  export interface MpvOptions { // 添加 export
    binary?: string | null;
    socket?: string;
    debug?: boolean;
    verbose?: boolean;
    audio_only?: boolean;
    time_update?: number;
    observeAllProperties?: boolean;
    [key: string]: any;
  }

  export interface Status { // 添加 export
    [key: string]: any;
    'time-pos'?: number;
    duration?: number;
    pause?: boolean;
    volume?: number;
    speed?: number;
    'playback-speed'?: number;
  }

  export interface EndFileEvent { // 添加 export
    reason: 'eof' | 'stop' | 'error' | 'quit' | 'unknown' | string;
    error?: number;
    [key: string]: any;
  }

  class MpvAPI {
    constructor(options?: MpvOptions | Record<string, any>, additionalArgs?: string[]);
    start(): Promise<void>;
    quit(): Promise<void>;
    load(filePath: string, mode?: 'replace' | 'append' | 'append-play', options?: string[]): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    stop(): Promise<void>;
    seek(timeSeconds: number, mode?: 'relative' | 'absolute' | 'absolute-percent' | 'relative-percent' | 'keyframes' | 'exact'): Promise<void>;
    volume(level: number): Promise<void>;
    setProperty(property: string, value: any): Promise<void>;
    getProperty(property: string): Promise<any>;
    observeProperty(property: string, typeId: number): Promise<void>;
    unobserveProperty(propertyId: number): Promise<void>;
    getDuration(): Promise<number | null>;
    getTimePosition(): Promise<number>;
    isRunning: boolean;

    on(event: 'statuschange', listener: (status: Status) => void): this;
    on(event: 'paused', listener: () => void): this;
    on(event: 'resumed', listener: () => void): this;
    on(event: 'timeposition', listener: (seconds: number) => void): this;
    on(event: 'stopped', listener: () => void): this;
    on(event: 'started', listener: () => void): this;
    on(event: 'endfile', listener: (event: EndFileEvent) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'crashed', listener: (exitCode: number) => void): this;
    on(event: 'seek', listener: (data: {start: number, end: number}) => void): this;
    on(event: 'playbackrestart', listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;

    removeAllListeners(event?: string): this;
  }

  export enum ObserveProperty { // 保持 export
    NONE = 0,
    STRING = 1,
    BOOLEAN = 2,
    NUMBER = 3,
    NODE = 4,
    TIME = 3,
  }

  export default MpvAPI;
}