import trackPlayer from "@renderer/core/track-player";
import messageBus from "@shared/message-bus/renderer/main";
import { audioAnalyzer } from "./analyzer.ts";
import { observeThemeChanges } from "./theme-colors.ts";

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

    // 应答可视化窗口的取帧请求（pull 模型）
    //
    // renderer 的 webpack target 是 web，不能 import electron，所以主世界
    // 把取帧回调注册进 preload（contextBridge 传函数），由 preload 在收到
    // 请求时调用。IPC 回调不受窗口隐藏时的 rAF 节流影响——这正是
    // 「可见窗口拉、隐藏窗口应」成立的前提。
    messageBus.setFrameProvider((from) => {
        const frame = audioAnalyzer.readFrame();
        messageBus.pushVisualizationFrame(frame, from);
    });

    // 主题色同步：主题包切换时变化，重读并同步给可视化窗口
    observeThemeChanges((colors) => {
        messageBus.syncAppState({ themeColors: colors });
    });
}

export { audioAnalyzer };
