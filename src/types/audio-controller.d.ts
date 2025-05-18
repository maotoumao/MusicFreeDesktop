// src/types/audio-controller.d.ts
import {PlayerState} from "@/common/constant";
import {CurrentTime, ErrorReason} from "@renderer/core/track-player/enum";

export interface IAudioController {
    // 是否有音源
    hasSource: boolean;

    playerState: PlayerState;

    musicItem: IMusic.IMusicItem | null;

    // 可选的初始化方法，主要用于像 MpvController 这样的异步初始化场景
    initialize?(): Promise<void>;

    // 可选的 readyPromise，用于等待控制器就绪
    readyPromise?: Promise<void>;

    // 准备音乐信息
    prepareTrack?(musicItem: IMusic.IMusicItem): void;

    // 设置音源
    setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): Promise<void>;

    // 暂停
    pause(): void;

    // 播放
    play(): void;

    // 设置音量
    setVolume(volume: number): void;

    // 跳转
    seekTo(seconds: number): void;

    // 设置循环
    setLoop(isLoop: boolean): void;

    // 设置播放速度
    setSpeed(speed: number): void;

    // 设置输出设备id
    setSinkId(deviceId: string): Promise<void>;

    // 清空当前播放的歌曲
    reset(): void;

    // 销毁audio实例
    destroy(): void;

    onPlayerStateChanged?: (playerState: PlayerState) => void;
    // 进度更新
    onProgressUpdate?: (progress: CurrentTime) => void;
    // 出错
    onError?: (type: ErrorReason, error?: any) => void;
    // 播放结束
    onEnded?: () => void;
    // 音量改变
    onVolumeChange?: (volume: number) => void;
    // 速度改变
    onSpeedChange?: (speed: number) => void;

}