import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hideModal } from "@/renderer/components/Modal";
import trackPlayer from "@renderer/core/track-player";
import { useCurrentMusic, useLyric } from "@renderer/core/track-player/hooks";
import { IWordLyricLine } from "@renderer/utils/word-lyric";
import { applyMusicMeta } from "@renderer/core/music-meta";
import classNames from "@/renderer/utils/classnames";
import PluginManager from "@shared/plugin-manager/renderer";
import { toast } from "react-toastify";
import { KaraokeRecorder } from "@renderer/core/karaoke/recorder";
import {
    fetchInstrumentalCandidates,
    IInstrumentalCandidate,
} from "@renderer/core/karaoke/instrumental";
import mixer from "@renderer/core/karaoke/mixer";
import { IScoreResult, scorePerformance, scoreUpTo } from "@renderer/core/karaoke/scorer";
import SvgAsset from "@/renderer/components/SvgAsset";
import Loading from "@/renderer/components/Loading";
import Slider from "rc-slider";
import "./index.scss";

/** 一行歌词的显示状态 */
type ILineState = "past" | "current" | "next";

/** 混音预设 */
type IMixPreset = "original" | "karaoke" | "instrumental";

interface ILyricLineProps {
    line?: IWordLyricLine;
    state: ILineState;
    /** 已经唱完的词数 */
    finishedWords?: number;
    /** 当前词的进度 0~1 */
    wordProgress?: number;
}

/**
 * 一行歌词。
 * 当前行逐字渲染：唱过的字高亮，正在唱的字按进度填充
 */
function LyricLine(props: ILyricLineProps) {
    const { line, state, finishedWords = 0, wordProgress = 0 } = props;

    if (!line) {
        return null;
    }
    return (
        <div className="karaoke-lyric-line" data-state={state}>
            {line.words.map((word, index) => {
                const wordState =
                    state !== "current"
                        ? state
                        : index < finishedWords
                            ? "sung"
                            : index === finishedWords
                                ? "singing"
                                : "unsung";
                const progress = wordState === "singing" ? wordProgress : 0;
                return (
                    <span
                        key={index}
                        className="karaoke-word"
                        data-state={wordState}
                        style={
                            {
                                "--karaoke-word-progress": progress,
                            } as CSSProperties
                        }
                    >
                        {word.text}
                    </span>
                );
            })}
        </div>
    );
}

export default function Karaoke() {
    const { t } = useTranslation();
    const musicItem = useCurrentMusic();
    const lyricContext = useLyric();
    const parser = lyricContext?.parser;

    /** 当前播放位置，单独用 rAF 跟，扫光才够顺滑 */
    const [time, setTime] = useState(0);
    const [showTranslation, setShowTranslation] = useState(true);
    const stageRef = useRef<HTMLDivElement>(null);

    /** 录音相关 */
    const recorderRef = useRef<KaraokeRecorder | null>(null);
    const [recording, setRecording] = useState(false);
    const [score, setScore] = useState<IScoreResult | null>(null);
    const [recordError, setRecordError] = useState<string | null>(null);

    /** 伴奏相关 */
    const [switching, setSwitching] = useState(false);
    /** 伴奏轨是不是正在播 */
    const [instrumentalActive, setInstrumentalActive] = useState(false);
    /** 伴奏候选列表 */
    const [candidates, setCandidates] = useState<IInstrumentalCandidate[]>([]);
    const [candidatesOpen, setCandidatesOpen] = useState(false);
    const [candidatesLoading, setCandidatesLoading] = useState(false);

    /** 人声推子：调原唱轨的增益，0~1 */
    const [vocalGain, setVocalGain] = useState(1);
    /** 伴奏推子：调伴奏轨的增益，0~1 */
    const [instrumentalGain, setInstrumentalGain] = useState(1);
    /** 用户手动动过推子没有，动过就不再自动套预设 */
    const mixerTouchedRef = useRef(false);

    useEffect(() => {
        let raf = 0;
        let last = -1;
        const tick = () => {
            const current = trackPlayer.progress.currentTime || 0;
            // 变化太小时不重渲染，省点开销
            if (Math.abs(current - last) > 0.03) {
                last = current;
                setTime(current);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
        };
    }, []);

    const wordLyric = parser?.getWordLyric() ?? null;
    const wordPosition = parser?.getWordPosition(time) ?? null;

    const lines = wordLyric?.lines ?? [];
    const currentIndex = wordPosition?.lineIndex ?? -1;
    const currentLine = currentIndex >= 0 ? lines[currentIndex] : undefined;
    const prevLine = currentIndex > 0 ? lines[currentIndex - 1] : undefined;
    const nextLine =
        currentIndex >= 0 && currentIndex < lines.length - 1
            ? lines[currentIndex + 1]
            : undefined;

    /** 翻译：按时间找对应的那一行 */
    const translation = useMemo(() => {
        if (!showTranslation || !parser) {
            return "";
        }
        const items = parser.getLyricItems();
        let matched = "";
        for (const item of items) {
            if (item.time <= time + 0.2) {
                matched = item.translation ?? "";
            } else {
                break;
            }
        }
        return matched;
    }, [showTranslation, parser, time, currentIndex]);

    const meta = musicItem ? applyMusicMeta(musicItem) : null;

    /** 所有该唱的词，摊平成一维 */
    const allWords = useMemo(
        () => (wordLyric?.lines ?? []).flatMap((line) => line.words),
        [wordLyric],
    );

    // 实时分数：录音时定期刷新
    // 进度放在 ref 里，定时器不跟着进度重建
    const timeRef = useRef(0);
    timeRef.current = time;
    useEffect(() => {
        if (!recording) {
            return;
        }
        const timer = setInterval(() => {
            const samples = recorderRef.current?.getSamples() ?? [];
            setScore(scoreUpTo(allWords, samples, timeRef.current));
        }, 300);
        return () => {
            clearInterval(timer);
        };
    }, [recording, allWords]);

    // 关掉界面时把麦克风还回去，伴奏轨与人声增益也一并复位
    useEffect(() => {
        return () => {
            recorderRef.current?.stop();
            recorderRef.current = null;
            mixer.stop();
            trackPlayer.setLocalGain(1);
        };
    }, []);

    // 人声推子作用在主播放器上，不写用户偏好
    useEffect(() => {
        trackPlayer.setLocalGain(vocalGain);
    }, [vocalGain]);

    // 伴奏推子作用在伴奏轨上
    useEffect(() => {
        mixer.setGain(instrumentalGain);
    }, [instrumentalGain]);

    const toggleRecording = async () => {
        setRecordError(null);
        if (recording) {
            const samples = recorderRef.current?.stop() ?? [];
            recorderRef.current = null;
            setRecording(false);
            setScore(scorePerformance(allWords, samples));
            return;
        }
        try {
            const recorder = new KaraokeRecorder();
            await recorder.start(() => trackPlayer.progress.currentTime || 0);
            recorderRef.current = recorder;
            setRecording(true);
            setScore(null);
        } catch (e: any) {
            recorderRef.current?.stop();
            recorderRef.current = null;
            setRecording(false);
            setRecordError(e?.message ?? String(e));
        }
    };

    /**
     * 伴奏按钮：
     * 伴奏轨已经在跑就停下来，否则展开候选列表让人挑
     */
    const toggleInstrumental = async () => {
        if (!musicItem?.platform || switching) {
            return;
        }
        if (instrumentalActive) {
            setSwitching(true);
            mixer.stop();
            setInstrumentalActive(false);
            setSwitching(false);
            return;
        }
        // 展开候选列表
        setCandidatesOpen((prev) => !prev);
        if (!candidates.length) {
            setCandidatesLoading(true);
            try {
                const list = await fetchInstrumentalCandidates(musicItem);
                setCandidates(list);
                if (!list.length) {
                    toast.info(t("modal.karaoke_no_instrumental"));
                }
            } catch {
                toast.error(t("modal.karaoke_instrumental_failed"));
            } finally {
                setCandidatesLoading(false);
            }
        }
    };

    /**
     * 选中某个伴奏候选。
     * 伴奏用一个独立的音轨与原唱同时播，两边各有一个推子
     */
    const applyInstrumental = async (candidate: IInstrumentalCandidate) => {
        setSwitching(true);
        try {
            const ok = await mixer.load(candidate);
            if (!ok) {
                toast.error(t("modal.karaoke_instrumental_failed"));
                return;
            }
            setInstrumentalActive(true);
            setCandidatesOpen(false);
            // 用户没手动调过推子时，直接进卡拉OK的混音状态
            if (!mixerTouchedRef.current) {
                setVocalGain(0.35);
                setInstrumentalGain(1);
            }
        } catch {
            toast.error(t("modal.karaoke_instrumental_failed"));
        } finally {
            setSwitching(false);
        }
    };

    /** 混音预设 */
    const applyPreset = (preset: IMixPreset) => {
        mixerTouchedRef.current = true;
        switch (preset) {
            case "original":
                setVocalGain(1);
                setInstrumentalGain(0);
                break;
            case "karaoke":
                setVocalGain(0.35);
                setInstrumentalGain(1);
                break;
            case "instrumental":
                setVocalGain(0);
                setInstrumentalGain(1);
                break;
        }
    };

    // 换歌了就回到原唱，伴奏轨也停掉
    useEffect(() => {
        mixer.stop();
        setInstrumentalActive(false);
        setCandidates([]);
        setCandidatesOpen(false);
        mixerTouchedRef.current = false;
        setVocalGain(1);
        setInstrumentalGain(1);
    }, [musicItem?.platform, musicItem?.id]);

    return (
        <div className="karaoke-container">
            <div className="karaoke-header">
                <div className="karaoke-title">
                    <div className="karaoke-song-title">
                        {meta?.title ?? t("modal.karaoke")}
                    </div>
                    <div className="karaoke-song-artist">
                        {meta?.artist ?? ""}
                    </div>
                </div>
                <div className="karaoke-header-actions">
                    <div
                        className={classNames({
                            "karaoke-btn": true,
                            "karaoke-btn-text": true,
                            active: instrumentalActive,
                        })}
                        role="button"
                        title={
                            instrumentalActive
                                ? t("modal.karaoke_stop_instrumental")
                                : t("modal.karaoke_instrumental")
                        }
                        data-disabled={switching}
                        onClick={() => {
                            void toggleInstrumental();
                        }}
                    >
                        {instrumentalActive
                            ? t("modal.karaoke_stop_instrumental")
                            : t("modal.karaoke_instrumental")}
                    </div>
                    <div
                        className="karaoke-btn"
                        role="button"
                        title={t("modal.karaoke_toggle_translation")}
                        data-active={showTranslation}
                        onClick={() => {
                            setShowTranslation((prev) => !prev);
                        }}
                    >
                        <SvgAsset iconName="language"></SvgAsset>
                    </div>
                    <div
                        className="karaoke-btn"
                        role="button"
                        title={t("modal.karaoke_close")}
                        onClick={() => {
                            hideModal();
                        }}
                    >
                        <SvgAsset iconName="x-mark"></SvgAsset>
                    </div>
                </div>
            </div>

            <div className="karaoke-stage" ref={stageRef}>
                {parser ? (
                    <>
                        <LyricLine line={prevLine} state="past"></LyricLine>
                        <LyricLine
                            line={currentLine}
                            state="current"
                            finishedWords={wordPosition?.finishedWords}
                            wordProgress={wordPosition?.wordProgress}
                        ></LyricLine>
                        <div className="karaoke-translation">
                            {translation}
                        </div>
                        <LyricLine line={nextLine} state="next"></LyricLine>
                    </>
                ) : (
                    <div className="karaoke-empty">
                        {t("modal.karaoke_no_lyric")}
                    </div>
                )}
            </div>

            {/** 人声与伴奏分开调，两个音轨同时响就能混出想要的效果 */}
            <div className="karaoke-mixer">
                <div className="karaoke-mixer-row">
                    <span className="karaoke-mixer-label">
                        {t("modal.karaoke_vocal")}
                    </span>
                    <div className="karaoke-mixer-slider">
                        <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={vocalGain}
                            onChange={(value) => {
                                mixerTouchedRef.current = true;
                                setVocalGain(value as number);
                            }}
                        />
                    </div>
                    <span className="karaoke-mixer-value">
                        {Math.round(vocalGain * 100)}%
                    </span>
                </div>
                <div className="karaoke-mixer-row">
                    <span
                        className="karaoke-mixer-label"
                        title={t("modal.karaoke_accompaniment_boost_hint")}
                    >
                        {t("modal.karaoke_accompaniment")}
                    </span>
                    <div className="karaoke-mixer-slider">
                        <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={instrumentalGain}
                            onChange={(value) => {
                                mixerTouchedRef.current = true;
                                setInstrumentalGain(value as number);
                            }}
                        />
                    </div>
                    <span className="karaoke-mixer-value">
                        {Math.round(instrumentalGain * 100)}%
                    </span>
                </div>
                <div className="karaoke-mixer-presets">
                    {(
                        ["original", "karaoke", "instrumental"] as IMixPreset[]
                    ).map((preset) => (
                        <div
                            className="karaoke-preset"
                            key={preset}
                            role="button"
                            onClick={() => {
                                applyPreset(preset);
                            }}
                        >
                            {t(`modal.karaoke_preset_${preset}`)}
                        </div>
                    ))}
                </div>
            </div>

            {candidatesOpen ? (
                <div className="karaoke-candidates">
                    <div className="karaoke-candidates-title">
                        {t("modal.karaoke_instrumental_list")}
                    </div>
                    {candidatesLoading ? (
                        <Loading></Loading>
                    ) : candidates.length ? (
                        <div className="karaoke-candidates-body">
                            {candidates.map((item) => {
                                const delta = Math.abs(
                                    Number(item.durationDelta) || 0,
                                );
                                return (
                                    <div
                                        className="karaoke-candidate"
                                        key={`${item.platform}-${item.id}`}
                                        role="button"
                                        onClick={() => {
                                            void applyInstrumental(item);
                                        }}
                                    >
                                        <div className="karaoke-candidate-info">
                                            <div className="title">
                                                {item.title}
                                            </div>
                                            <div className="artist">
                                                {item.artist || "-"}
                                            </div>
                                        </div>
                                        <div className="karaoke-candidate-tags">
                                            <div className="source-tag">
                                                {PluginManager.getPluginDisplayName(
                                                    item.platform,
                                                )}
                                            </div>
                                            {item.isKaraoke ? (
                                                <div className="karaoke-tag">
                                                    {t(
                                                        "modal.karaoke_karaoke_tag",
                                                    )}
                                                </div>
                                            ) : null}
                                            {item.hasMv ? (
                                                <div className="mv-tag">
                                                    {t("modal.karaoke_mv_tag")}
                                                </div>
                                            ) : null}
                                            {item.isOriginArtist ? (
                                                <div className="origin-tag">
                                                    {t(
                                                        "modal.karaoke_origin_tag",
                                                    )}
                                                </div>
                                            ) : null}
                                            {item.duration ? (
                                                <div className="duration">
                                                    {Math.floor(item.duration / 60)}:
                                                    {(
                                                        item.duration % 60
                                                    )
                                                        .toString()
                                                        .padStart(2, "0")}
                                                </div>
                                            ) : null}
                                            {delta > 0 ? (
                                                <div className="delta">
                                                    {t(
                                                        "modal.karaoke_duration_delta",
                                                        { seconds: delta },
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="karaoke-candidates-empty">
                            {t("modal.karaoke_no_instrumental")}
                        </div>
                    )}
                </div>
            ) : null}

            <div className="karaoke-footer">
                <div className="karaoke-score-panel">
                    {score ? (
                        <>
                            <span className="karaoke-score-total">
                                {score.total}
                            </span>
                            <span className="karaoke-score-item">
                                {t("modal.karaoke_score_timing")}{" "}
                                {score.timing}
                            </span>
                            <span className="karaoke-score-item">
                                {t("modal.karaoke_score_coverage")}{" "}
                                {score.coverage}
                            </span>
                            <span className="karaoke-score-item">
                                {t("modal.karaoke_score_pitch")}{" "}
                                {score.pitch}
                            </span>
                        </>
                    ) : null}
                    {recordError ? (
                        <span className="karaoke-error">{recordError}</span>
                    ) : null}
                </div>
                <div
                    className={classNames({
                        "karaoke-record-btn": true,
                        recording,
                    })}
                    role="button"
                    title={
                        recording
                            ? t("modal.karaoke_stop")
                            : t("modal.karaoke_record")
                    }
                    onClick={() => {
                        void toggleRecording();
                    }}
                >
                    <SvgAsset iconName="microphone"></SvgAsset>
                    <span className="karaoke-record-text">
                        {recording
                            ? t("modal.karaoke_stop")
                            : t("modal.karaoke_record")}
                    </span>
                </div>
            </div>
        </div>
    );
}
