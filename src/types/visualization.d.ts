declare namespace IVisualization {
    /** 一帧音频分析数据 —— 所有可视化效果共用的唯一数据来源 */
    interface IAudioFrame {
        /** 512 个 bin，对数分布（低频稀、高频密），取值 0..255 */
        frequency: Uint8Array;
        /** 256 个时域采样点，取值 0..255（128 = 静音中心） */
        waveform: Uint8Array;
        /** 总体能量 0..1 */
        level: number;
        /** 节拍包络 0..1 */
        beat: number;
        /** 估算 BPM，估不出来时为 0 */
        bpm: number;
        /** 是否正在播放 */
        playing: boolean;
        /** false = 此音源无法可视化（跨域等），效果应降级并给出提示 */
        available: boolean;
    }

    /** 主题配色，跟随主窗口当前主题包 */
    interface IThemeColors {
        /** --primaryColor */
        primary: string;
        /** --textColor */
        text: string;
        /** --backgroundColor */
        background: string;
    }
}
