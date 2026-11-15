import { PlayerState } from "@/common/constant";
import { CurrentTime, ErrorReason } from "@renderer/core/track-player/enum";

export interface IAudioController {
    // 是否有音源
    hasSource: boolean;

    /**
     * 实际播放的 audio 元素（只读）。
     * 可视化分析用；调用方不得改动 src / crossOrigin / volume。
     */
    mediaElement: HTMLAudioElement;

    playerState: PlayerState;

    musicItem: IMusic.IMusicItem | null;

    // 实际用于播放的地址
    resolvedSourceUrl: string | null;

    // 准备音乐信息
    prepareTrack?(musicItem: IMusic.IMusicItem): void;

    // 设置音源
    setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): void;

    // 暂停
    pause(): void;

    // 播放
    play(): void;

    // 设置音量
    setVolume(volume: number): void;

    // 设置本地增益（唱卡拉OK 的人声推子，不写用户偏好）
    setLocalGain?(gain: number): void;

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

