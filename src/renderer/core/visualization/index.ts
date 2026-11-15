import trackPlayer from "@renderer/core/track-player";
import { audioAnalyzer } from "./analyzer.ts";

let started = false;

/**
 * 启动可视化服务（主窗口侧）。
 *
 * 负责把音频元素和分析器绑在一起：
 * - 元素开始出声（playing）时采集——此刻元素上才有资源；
 * - 元素换源（loadstart）时解绑——旧的 capture track 会随旧源结束，
 *   不重新绑定会残留上一首的频谱。
 *
 * **不跟播放器事件走**：`PlayerEvents.MusicChanged` 是在 `setCurrentMusic()`
 * 里发的，早于 `setTrack()` 给元素赋新 src，那一刻元素上还没有资源，
 * capture 不到东西。
 */
export function startVisualizationService(): void {
    if (started) {
        return;
    }
    started = true;

    const element = trackPlayer.mediaElement;
    if (!element) {
        return;
    }

    let needsAttach = false;

    element.addEventListener("loadstart", () => {
        // 换源：旧流随旧源结束，先解绑避免残留上一首的数据
        audioAnalyzer.detach();
        needsAttach = true;
    });

    element.addEventListener("playing", () => {
        if (needsAttach || !audioAnalyzer.isAvailable) {
            audioAnalyzer.attach(element);
            needsAttach = false;
        }
    });

    // 服务启动时可能已经在播了
    if (element.src && !element.paused) {
        audioAnalyzer.attach(element);
    }
}

export { audioAnalyzer };
