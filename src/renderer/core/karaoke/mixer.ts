/**
 * 卡拉OK 混音
 *
 * 主播放器继续放原唱，伴奏用一个独立的 audio 元素同时播。
 * 两条轨各有一个推子：人声推子调原唱轨，伴奏推子调伴奏轨，
 * 两者叠加就得到「歌声 + 伴奏」的效果，也能单独压掉人声只留伴奏。
 *
 * 伴奏轨与主播放器是两个文件，天然会各自漂移，
 * 这里定时把伴奏轨拉回主播放器的进度上。
 */

import { encodeUrlHeaders } from "@/common/normalize-util";
import { PlayerState } from "@/common/constant";
import PluginManager from "@shared/plugin-manager/renderer";
import ServiceManager from "@shared/service-manager/renderer";
import trackPlayer from "@renderer/core/track-player";
import { IInstrumentalCandidate } from "@renderer/core/karaoke/instrumental";

/** 伴奏轨与主播放器允许的偏差（秒），超过就重新对齐 */
const MAX_DRIFT = 0.4;

/** 对齐检查间隔（毫秒） */
const SYNC_INTERVAL = 500;

/**
 * 伴奏轨的响度补偿倍数。
 * 伴奏素材本身比原唱轻，不给余量的话伴奏推子拉满也只有原唱那么响，
 * 唱卡拉OK 时伴奏被原唱压着听不见。
 */
const ACCOMPANIMENT_BOOST = 2;

class KaraokeMixer {
    /** 伴奏轨的 audio 元素，懒创建 */
    private audio: HTMLAudioElement | null = null;

    /** 对齐用的定时器 */
    private timer: ReturnType<typeof setInterval> | null = null;

    /** 伴奏推子，0~1 */
    private gain = 1;

    /** 当前正在播的伴奏候选 */
    private candidate: IInstrumentalCandidate | null = null;

    /** 伴奏轨的地址，换歌时用来判断要不要重载 */
    private sourceUrl: string | null = null;

    /**
     * 取伴奏音源。
     * 插件有可能直接把地址塞在候选条目里，有就直接用，省一次请求
     */
    private async resolveSource(
        candidate: IInstrumentalCandidate,
    ): Promise<IPlugin.IMediaSourceResult | null> {
        const embeddedUrl = String(candidate.url ?? "").trim();
        if (embeddedUrl) {
            return {
                url: embeddedUrl,
                headers: candidate.headers ?? undefined,
            };
        }
        const source = await PluginManager.callPluginDelegateMethod(
            { platform: candidate.platform },
            "getMediaSource",
            candidate,
            trackPlayer.currentQuality,
        );
        return source?.url ? source : null;
    }

    /** 处理带请求头的音源：优先走本地转发，其次用 url hack */
    private resolvePlayableUrl(source: IPlugin.IMediaSourceResult): string {
        const headers = source.headers ?? undefined;
        if (!headers || !Object.keys(headers).length) {
            return source.url;
        }
        const forwarded = ServiceManager.RequestForwarderService.forwardRequest(
            source.url,
            "GET",
            headers,
        );
        if (forwarded) {
            return forwarded;
        }
        return encodeUrlHeaders(source.url, headers);
    }

    private ensureAudio(): HTMLAudioElement {
        if (!this.audio) {
            const audio = new Audio();
            audio.preload = "auto";
            audio.controls = false;
            this.audio = audio;
            // @ts-ignore 调试用：与主播放器的 window.ad 一个套路
            window.adKaraoke = audio;
        }
        return this.audio;
    }

    /**
     * 载入并开始播放某个伴奏候选。
     * 主播放器不动，人声与伴奏同时响
     */
    public async load(candidate: IInstrumentalCandidate): Promise<boolean> {
        if (!candidate?.platform || !candidate?.id) {
            return false;
        }
        let source: IPlugin.IMediaSourceResult | null = null;
        try {
            source = await this.resolveSource(candidate);
        } catch {
            source = null;
        }
        if (!source?.url) {
            this.stop();
            return false;
        }

        const audio = this.ensureAudio();
        this.candidate = candidate;
        this.sourceUrl = source.url;
        audio.src = this.resolvePlayableUrl(source);
        audio.volume = this.getEffectiveVolume();
        audio.playbackRate = trackPlayer.speed || 1;

        // 等元数据到位才知道地址真的能用，
        // 顺便把伴奏轨对齐到主播放器当前进度
        const loaded = await this.waitForMetadata(audio);
        if (!loaded) {
            this.stop();
            return false;
        }
        const position = trackPlayer.progress.currentTime || 0;
        if (position > 0 && isFinite(audio.duration)) {
            audio.currentTime = Math.min(position, audio.duration);
        }

        this.startSync();
        try {
            await audio.play();
        } catch {
            // 浏览器可能拦了自动播放，等用户点了播放再补
        }
        return true;
    }

    /** 等元数据就绪。取不到就返回 false，最多等 8 秒 */
    private waitForMetadata(audio: HTMLAudioElement): Promise<boolean> {
        if (audio.readyState >= 1) {
            return Promise.resolve(true);
        }
        return new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                audio.removeEventListener("loadedmetadata", onReady);
                audio.removeEventListener("error", onError);
                resolve(ok);
            };
            const onReady = () => {
                finish(true);
            };
            const onError = () => {
                finish(false);
            };
            const timer = setTimeout(() => {
                finish(true);
            }, 8000);
            audio.addEventListener("loadedmetadata", onReady);
            audio.addEventListener("error", onError);
        });
    }

    /** 停止伴奏轨 */
    public stop() {
        this.stopSync();
        if (this.audio) {
            this.audio.pause();
            this.audio.removeAttribute("src");
            this.audio.load?.();
        }
        this.candidate = null;
        this.sourceUrl = null;
    }

    /** 伴奏推子，0~1 */
    public setGain(gain: number) {
        this.gain = Math.min(1, Math.max(0, Number(gain) || 0));
        this.applyGain();
    }

    public getGain() {
        return this.gain;
    }

    public getCandidate() {
        return this.candidate;
    }

    public isActive() {
        return !!this.candidate && !!this.sourceUrl;
    }

    /**
     * 伴奏轨音量 = 全局音量 × 伴奏推子 × 伴奏补偿。
     *
     * 补偿是必要的：伴奏素材本身的响度天然比原唱低一截，
     * 不给余量的话伴奏推子拉满也只有「原唱轨」那么响，
     * 唱卡拉OK 时伴奏被原唱压着，几乎听不见。
     * 有了余量，伴奏推子拉满能到原唱轨的两倍，跟唱时伴奏才是主角。
     */
    private getEffectiveVolume(): number {
        const globalVolume = trackPlayer.volume;
        const base = isFinite(globalVolume) ? globalVolume : 1;
        return Math.min(1, Math.max(0, base * this.gain * ACCOMPANIMENT_BOOST));
    }

    private applyGain() {
        if (!this.audio) {
            return;
        }
        const volume = this.getEffectiveVolume();
        if (Math.abs(this.audio.volume - volume) < 0.001) {
            return;
        }
        this.audio.volume = volume;
    }

    private startSync() {
        this.stopSync();
        this.timer = setInterval(() => {
            this.syncOnce();
        }, SYNC_INTERVAL);
    }

    private stopSync() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** 定时把伴奏轨对齐到主播放器 */
    private syncOnce() {
        const audio = this.audio;
        if (!audio || !this.candidate) {
            return;
        }

        // 跟着主播放器的播放状态走
        const state = trackPlayer.playerState;
        if (state === PlayerState.Playing) {
            if (audio.paused) {
                audio.play().catch(() => undefined);
            }
        } else if (!audio.paused) {
            audio.pause();
        }

        // 倍速跟着主播放器
        const speed = trackPlayer.speed || 1;
        if (Math.abs(audio.playbackRate - speed) > 0.01) {
            audio.playbackRate = speed;
        }

        // 全局音量改了，伴奏轨要跟着重新算（伴奏轨的电平依赖全局音量）
        this.applyGain();

        if (audio.readyState < 1 || audio.seeking) {
            return;
        }

        const mainTime = trackPlayer.progress.currentTime;
        if (!isFinite(mainTime)) {
            return;
        }
        if (Math.abs(audio.currentTime - mainTime) > MAX_DRIFT) {
            audio.currentTime = mainTime;
        }
    }
}

export default new KaraokeMixer();
