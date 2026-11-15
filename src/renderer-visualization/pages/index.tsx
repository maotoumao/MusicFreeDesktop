import { useEffect, useRef, useState } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";

import useAppConfig from "@/hooks/useAppConfig";
import messageBus, {
    useAppStatePartial,
} from "@shared/message-bus/renderer/extension";
import { createEngine, type IEngine } from "@renderer-visualization/core/engine";
import {
    effectIds,
    effectRegistry,
} from "@renderer-visualization/core/effects";
import { defaultVisualizationThemeColors } from "@/common/visualization-constant";

/** 还没有收到任何帧时的占位帧 */
const emptyFrame: IVisualization.IAudioFrame = {
    frequency: new Uint8Array(512),
    waveform: new Uint8Array(256),
    level: 0,
    beat: 0,
    bpm: 0,
    playing: false,
    available: false,
};

/**
 * 可视化窗口页面。
 *
 * 窗口是纯被动的：只有一块 canvas（+ 降级时的一行提示文字），
 * 没有任何交互控件——开关与效果选择都在主窗口里做。
 */
export default function VisualizationPage() {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<IEngine | null>(null);
    /** 此音源无法可视化（跨域等） */
    const [unavailable, setUnavailable] = useState(false);

    // 引擎每帧要读这些值，放 ref 里避免每帧重建闭包
    const frameRef = useRef<IVisualization.IAudioFrame>(emptyFrame);
    const colorsRef = useRef<IVisualization.IThemeColors>(
        defaultVisualizationThemeColors,
    );
    const modeRef = useRef<string>("random");

    const effect = useAppConfig("visualization.effect");
    const themeColors = useAppStatePartial("themeColors");
    const musicItem = useAppStatePartial("musicItem");

    modeRef.current = effect;
    colorsRef.current = themeColors ?? defaultVisualizationThemeColors;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const engine = createEngine(canvas, {
            getMode: () => modeRef.current,
            getAllIds: () => effectIds,
            getFrame: () => frameRef.current,
            getColors: () => colorsRef.current,
            registry: effectRegistry,
        });
        engineRef.current = engine;

        const onFrame = (frame: IVisualization.IAudioFrame) => {
            frameRef.current = frame;
            // 跨域音源会一直回 available=false 的帧——此时停画并明确告知用户，
            // 而不是让画面静默冻结（静默冻结和「功能坏了」在用户眼里没区别）
            const isUnavailable = !frame.available;
            setUnavailable(isUnavailable);
            if (isUnavailable) {
                engineRef.current?.pause();
            } else {
                engineRef.current?.resume();
            }
        };
        messageBus.onVisualizationFrame(onFrame);

        // pull 模型：每帧向主窗口要一帧数据。
        // 主窗口最小化时它的 rAF 会被节流，但 IPC 回调不受影响，
        // 所以主窗口隐藏时可视化依然在动。
        let rafId = 0;
        const tick = () => {
            rafId = requestAnimationFrame(tick);
            if (!document.hidden) {
                messageBus.requestFrame();
            }
        };
        rafId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafId);
            messageBus.offVisualizationFrame(onFrame);
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    // 换歌时通知引擎：随机模式下换一个效果
    useEffect(() => {
        engineRef.current?.notifyMusicChanged();
    }, [musicItem]);

    // 效果选择变化时立刻换效果
    useEffect(() => {
        engineRef.current?.setEffect(effect);
    }, [effect]);

    return (
        <div className="visualization-page">
            <canvas ref={canvasRef} className="visualization-canvas"></canvas>
            {unavailable && (
                <div className="visualization-unavailable">
                    {t("settings.visualization.unavailable")}
                </div>
            )}
        </div>
    );
}
