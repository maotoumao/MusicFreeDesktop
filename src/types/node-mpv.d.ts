// src/types/node-mpv.d.ts

declare module 'node-mpv' {
  export interface MpvOptions {
    binary?: string | null;
    socket?: string;
    debug?: boolean;
    verbose?: boolean;
    audio_only?: boolean;
    time_update?: number; // Note: if time_update is set, node-mpv might emit 'timeposition' itself. My MpvManager polls.
    [key: string]: any;
  }

  export interface Status { // For 'status' event from node-mpv if used directly
    property: string;
    value: any;
  }

  export interface EndFileEventData { // Corresponds to mpv's end-file event data
    reason: 'eof' | 'stop' | 'quit' | 'error' | 'unknown' | string; // More specific reasons
    file_error?: string; // mpv's file_error property if reason is 'error'
    [key: string]: any; // Other potential properties from mpv's event
  }
  
  // For 'playback-finished' event which is a custom emission from the fork based on 'end-file'
  export interface PlaybackFinishedEvent { 
    reason: 'eof'; // This specific fork emits this only for eof
  }


  class MpvAPI {
    constructor(options?: MpvOptions | Record<string, any>, additionalArgs?: string[]);
    start(): Promise<void>;
    quit(): Promise<void>;
    load(filePath: string, mode?: 'replace' | 'append' | 'append-play', options?: string[]): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    stop(): Promise<void>;
    seek(timeSeconds: number, mode?: 'relative' | 'absolute' | 'absolute-percent' | 'relative-percent' | 'keyframes' | 'exact'): Promise<void>;
    volume(level: number): Promise<void>; // 0-100 for mpv
    speed(factor: number): Promise<void>;
    setProperty(property: string, value: any): Promise<void>;
    getProperty(property: string): Promise<any>;
    observeProperty(property: string, id?: number): Promise<void>; // id is optional in some forks or versions
    unobserveProperty(id: number): Promise<void>; // Typically by id given during observe
    
    getDuration(): Promise<number | null>; // Can be null
    getTimePosition(): Promise<number | null>; // Can be null
    
    isRunning(): boolean;

    // Events from the ctzzg-node-mpv fork's _events.js
    // Note: The fork's EventEmitter emits these based on parsing MPV's JSON IPC messages.
    on(event: 'status', listener: (status: Status) => void): this;
    on(event: 'paused', listener: () => void): this;
    on(event: 'resumed', listener: () => void): this;
    // 'timeposition' is often a custom event from wrappers that poll 'time-pos'.
    // The fork's _events.js emits 'status' for 'time-pos' changes.
    // If MpvManager polls and sends 'mpv-timeposition', that's separate.
    // For direct node-mpv usage, you'd listen to 'status' for 'time-pos'.
    // on(event: 'timeposition', listener: (seconds: number) => void): this;
    
    on(event: 'stopped', listener: (data?: { reason?: string, error?: string | number }) => void): this; // Fork's 'stopped' can come from non-eof 'end-file'
    on(event: 'started', listener: () => void): this; // Fork emits this on 'file-loaded'
    
    // Fork specific: 'playback-finished' is emitted ONLY for 'end-file' with reason 'eof'
    on(event: 'playback-finished', listener: (data: PlaybackFinishedEvent) => void): this;
    
    on(event: 'error', listener: (error: Error) => void): this; // Internal errors or IPC errors
    on(event: 'crashed', listener: () => void): this; // MPV process crashed
    on(event: 'seek', listener: (data: {start: number, end: number}) => void): this; // Emitted after seek completes

    on(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    // Add other EventEmitter methods if needed (once, off, etc.)
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
  }

  export default MpvAPI;
}