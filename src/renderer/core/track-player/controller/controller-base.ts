import { CurrentTime, ErrorReason } from "@renderer/core/track-player/enum";
import { PlayerState } from "@/common/constant";

export default class ControllerBase {
    public onPlayerStateChanged?: (state: PlayerState) => void;
    // 进度更新
    public onProgressUpdate?: (progress: CurrentTime) => void;
    // 出错
    public onError?: (type: ErrorReason, error?: any) => void;
    // 播放结束
    public onEnded?: () => void;
    // 音量改变
    public onVolumeChange?: (volume: number) => void;
    // 速度改变
    public onSpeedChange?: (speed: number) => void;
    // 播放中断：进度长时间不推进，音源大概率已经断了
    public onStalled?: () => void;
    // 本地音源不完整：实际时长明显短于标称时长
    public onSourceIncomplete?: (actualDuration: number, declaredDuration: number) => void;

}
