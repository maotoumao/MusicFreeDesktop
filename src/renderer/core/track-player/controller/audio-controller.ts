/**
 * 播放音乐
 */
import {encodeUrlHeaders} from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls, {Events as HlsEvents, HlsConfig} from "hls.js";
import {isSameMedia} from "@/common/media-util";
import {PlayerState} from "@/common/constant";
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import {ErrorReason} from "@renderer/core/track-player/enum";
import {IAudioController} from "@/types/audio-controller";

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { getGlobalContext } from '@/shared/global-context/renderer';
import { fsUtil as electronFsUtil } from '@shared/utils/renderer';

declare global {
    interface Window {
        path: typeof import('node:path');
    }
}

class AudioController extends ControllerBase implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls | null = null;

    private ffmpeg: FFmpeg;
    private ffmpegLoaded = false;
    private audioContext: AudioContext | null = null;
    private pcmSourceNode: AudioBufferSourceNode | null = null;
    private pcmBuffer: AudioBuffer | null = null;
    private pcmPlayStartTime = 0;
    private pcmCurrentOffset = 0;
    private 正在使用FFmpeg = false;
    private currentTrackSource: IMusic.IMusicSource | null = null;
    private ffmpegProgressAnimationId: number | null = null;
    private gainNode: GainNode | null = null;

    private _playerState: PlayerState = PlayerState.None;
    get playerState() {
        return this._playerState;
    }
    set playerState(value: PlayerState) {
        if (this._playerState !== value) {
            this.onPlayerStateChanged?.(value);
        }
        this._playerState = value;
    }

    public musicItem: IMusic.IMusicItem | null = null;

    get hasSource() {
        return !!this.audio.src || (this.正在使用FFmpeg && !!this.pcmBuffer);
    }

    constructor() {
        super();
        this.ffmpeg = new FFmpeg();
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.controls = false;

        this.audio.onplaying = () => {
            if (this.正在使用FFmpeg) return;
            this.playerState = PlayerState.Playing;
            if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
        };

        this.audio.onpause = () => {
            if (this.正在使用FFmpeg) return;
            if (!this.audio.ended) {
                this.playerState = PlayerState.Paused;
            }
            if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
        };

        this.audio.onerror = async (event: Event) => {
            if (this.正在使用FFmpeg) return;
            const audioElement = event.target as HTMLAudioElement;
            const htmlAudioError = audioElement.error;

            if (htmlAudioError && this.musicItem && (htmlAudioError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || htmlAudioError.code === MediaError.MEDIA_ERR_DECODE)) {
                console.warn(`Native playback failed (code: ${htmlAudioError.code}, message: ${htmlAudioError.message}) for ${this.musicItem.title}, trying FFmpeg.`);
                if (this.currentTrackSource) {
                    this.正在使用FFmpeg = true;
                    this.playerState = PlayerState.Buffering;
                    this.audio.removeAttribute('src');
                    this.audio.load();
                    try {
                        await this.tryDecodeAndPlayWithFFmpeg(this.currentTrackSource, this.musicItem);
                    } catch (e) {
                        console.error("FFmpeg playback failed:", e);
                        this.playerState = PlayerState.None;
                        this.onError?.(ErrorReason.UnsupportedResource, e);
                        this.正在使用FFmpeg = false;
                    }
                } else {
                    console.error("Cannot fallback to FFmpeg: currentTrackSource is null.");
                    this.playerState = PlayerState.None;
                    this.onError?.(ErrorReason.EmptyResource, "Track source missing for FFmpeg fallback.");
                }
            } else {
                this.playerState = PlayerState.Paused;
                this.onError?.(ErrorReason.EmptyResource, htmlAudioError || "Unknown audio error");
            }
        };

        this.audio.ontimeupdate = () => {
            if (this.正在使用FFmpeg) return;
            this.onProgressUpdate?.({
                currentTime: this.audio.currentTime,
                duration: this.audio.duration,
            });
        };

        this.audio.onended = () => {
            if (this.正在使用FFmpeg) return;
            this.playerState = PlayerState.Paused;
            this.onEnded?.();
        };

        this.audio.onvolumechange = () => {
            this.onVolumeChange?.(this.audio.volume);
        };

        this.audio.onratechange = () => {
            this.onSpeedChange?.(this.audio.playbackRate);
        };

        // @ts-ignore
        window.ad = this.audio;

        this._loadFFmpeg().catch(e => console.error("Failed to load FFmpeg on init:", e));
    }

    private async _fileToBlobURL(filePath: string, mimeType: string): Promise<string> {
        try {
            const fileDataNodeBuffer = await electronFsUtil.readFile(filePath);

            if (!fileDataNodeBuffer || typeof (fileDataNodeBuffer as any).buffer === 'undefined') {
                console.error(`_fileToBlobURL: readFile for ${filePath} did not return a Buffer-like object. Received:`, fileDataNodeBuffer);
                throw new Error('readFile did not return a Buffer-like object.');
            }
            
            const nodeBuffer = fileDataNodeBuffer as unknown as { buffer: ArrayBuffer, byteOffset: number, byteLength: number };

            const blob = new Blob(
                [nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength)],
                { type: mimeType }
            );
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error(`Failed to read file and create Blob URL for ${filePath}:`, error);
            throw error;
        }
    }

    private async _loadFFmpeg() {
        if (this.ffmpegLoaded) return;
        if (this.ffmpeg.loaded) {
            this.ffmpegLoaded = true;
            console.log("FFmpeg core already loaded by the library instance.");
            return;
        }
    
        try {
            const globalContext = getGlobalContext();
            const resPath = globalContext.appPath.res;
            const ffmpegBasePath = window.path.join(resPath, 'ffmpeg');
    
            const coreJSPath = window.path.join(ffmpegBasePath, 'ffmpeg-core.js');
            const wasmPath = window.path.join(ffmpegBasePath, 'ffmpeg-core.wasm');
            const mainWorkerJSPath = window.path.join(ffmpegBasePath, '814.ffmpeg.js');
    
            const coreURL = electronFsUtil.addFileScheme(coreJSPath);
            const wasmURL = electronFsUtil.addFileScheme(wasmPath);
            const workerURL = electronFsUtil.addFileScheme(mainWorkerJSPath);
    
            console.log("[FFMPEG] Attempting to load with file:// URLs:");
            console.log("[FFMPEG] coreURL:", coreURL);
            console.log("[FFMPEG] wasmURL:", wasmURL);
            console.log("[FFMPEG] workerURL:", workerURL);
    
            await this.ffmpeg.load({ coreURL, wasmURL, workerURL });
    
            this.ffmpeg.on('log', ({ type, message }) => {
                // console.log(`[FFMPEG Log - ${type}]: ${message}`); // 按需开启日志
            });
            this.ffmpegLoaded = true;
            console.log("FFmpeg core and main worker loaded successfully via file:// URLs.");
    
        } catch (e) {
            console.error("Failed to load FFmpeg with file:// URLs:", e);
        }
    }

    public async tryDecodeAndPlayWithFFmpeg(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem) {
        if (!this.ffmpegLoaded) {
            console.warn("[FFMPEG] FFmpeg not loaded, attempting to load now...");
            await this._loadFFmpeg();
            if (!this.ffmpegLoaded) {
                this.onError?.(ErrorReason.UnsupportedResource, new Error("FFmpeg core failed to load."));
                this.playerState = PlayerState.None;
                this.正在使用FFmpeg = false;
                return;
            }
        }
        if (!trackSource?.url) {
            this.onError?.(ErrorReason.EmptyResource, new Error("Track source URL is missing for FFmpeg."));
            this.playerState = PlayerState.None;
            this.正在使用FFmpeg = false;
            return;
        }
    
        this.resetAudioContextAndSourceNode();
    
        try {
            this.playerState = PlayerState.Buffering;
            this.onPlayerStateChanged?.(this.playerState);
    
            let urlForFetching = trackSource.url;
            let headersForFetching: Record<string, string> = {};
    
            if (trackSource.headers) {
                headersForFetching = { ...trackSource.headers };
            }
            if (trackSource.userAgent) {
                headersForFetching['User-Agent'] = trackSource.userAgent;
            }
    
            const urlObjOriginal = new URL(urlForFetching);
            if (urlObjOriginal.username && urlObjOriginal.password) {
                const authHeader = `Basic ${btoa(
                    `${decodeURIComponent(urlObjOriginal.username)}:${decodeURIComponent(urlObjOriginal.password)}`
                )}`;
                headersForFetching['Authorization'] = authHeader;
                urlObjOriginal.username = "";
                urlObjOriginal.password = "";
                urlForFetching = urlObjOriginal.toString();
            }
    
            console.log(`[FFMPEG] Preparing to process audio from: ${urlForFetching}`);
            let audioData: Uint8Array;
    
            if (urlForFetching.startsWith('file://')) {
                let filePath = '';
                try {
                    const parsedUrl = new URL(urlForFetching);
                    let tempPath = decodeURIComponent(parsedUrl.pathname);
    
                    const isWindows = navigator.platform.indexOf('Win') > -1;
                    if (isWindows) {
                        if (tempPath.startsWith('/')) {
                            tempPath = tempPath.replace(/^\//, '');
                        }
                        if (tempPath.startsWith('/')) {
                            filePath = `\\\\${tempPath.replace(/\//g, '\\')}`;
                        } else {
                            filePath = tempPath.replace(/\//g, '\\');
                        }
                    } else {
                        filePath = tempPath;
                    }
                } catch (e) {
                    console.error(`[FFMPEG] Error parsing file URL: ${urlForFetching}`, e);
                    throw new Error(`Invalid file URL: ${urlForFetching}`);
                }
                console.log(`[FFMPEG] Reading local file via fsUtil, processed path: "${filePath}"`);
                const nodeBufferData = await electronFsUtil.readFile(filePath);
                if (!nodeBufferData || typeof (nodeBufferData as any).buffer === 'undefined') {
                     console.error(`tryDecodeAndPlayWithFFmpeg: readFile for ${filePath} did not return a Buffer-like object. Received:`, nodeBufferData);
                    throw new Error('readFile did not return a Buffer-like object for local file.');
                }
                const nodeBuffer = nodeBufferData as unknown as { buffer: ArrayBuffer, byteOffset: number, byteLength: number };
                audioData = new Uint8Array(
                    nodeBuffer.buffer,
                    nodeBuffer.byteOffset,
                    nodeBuffer.byteLength
                );
            } else if (urlForFetching.startsWith('http:') || urlForFetching.startsWith('https://')) {
                console.log(`[FFMPEG] Fetching with native fetch: ${urlForFetching}`);
                console.log(`[FFMPEG] Headers for fetch:`, headersForFetching);
                const response = await fetch(urlForFetching, { headers: headersForFetching as HeadersInit });
                if (!response.ok) {
                    throw new Error(`Failed to fetch audio from ${urlForFetching}: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                audioData = new Uint8Array(arrayBuffer);
            } else {
                throw new Error(`Unsupported URL scheme for FFmpeg input: ${urlForFetching}`);
            }
    
            console.log(`[FFMPEG] Audio data fetched/read, size: ${audioData.length}`);
    
            const inputFilename = `input_${musicItem.id || 'unknown'}_${Date.now()}`;
            const outputFilename = 'output.pcm';
    
            await this.ffmpeg.writeFile(inputFilename, audioData);
            console.log(`[FFMPEG] Wrote input file to MEMFS: ${inputFilename}`);
    
            const ffmpegCommand = ['-i', inputFilename, '-f', 's16le', '-ar', '44100', '-ac', '2', outputFilename];
            console.log(`[FFMPEG] Executing: ${ffmpegCommand.join(' ')}`);
            await this.ffmpeg.exec(ffmpegCommand);
            console.log(`[FFMPEG] Decoding complete.`);
    
            const pcmDataResult = await this.ffmpeg.readFile(outputFilename, 'binary');
            if (!(pcmDataResult instanceof Uint8Array)) {
                console.error("[FFMPEG] Failed to read PCM data as Uint8Array. Received type:", typeof pcmDataResult);
                throw new Error("FFmpeg readFile did not return Uint8Array for PCM data.");
            }
            const pcmData: Uint8Array = pcmDataResult;
    
            console.log(`[FFMPEG] Read PCM data, size: ${pcmData.length}`);
    
            await this.ffmpeg.deleteFile(inputFilename);
            await this.ffmpeg.deleteFile(outputFilename);
            console.log(`[FFMPEG] Cleaned up MEMFS files.`);
    
            this.musicItem = musicItem;
            await this._playPcmData(pcmData);
        } catch (e) {
            console.error("[FFMPEG] Error during decoding or playback:", e);
            this.playerState = PlayerState.None;
            this.onPlayerStateChanged?.(this.playerState);
            this.onError?.(ErrorReason.UnsupportedResource, e);
            this.正在使用FFmpeg = false;
        }
    }

    private resetAudioContextAndSourceNode() {
        this.cancelFFmpegProgressUpdate();
        
        if (this.pcmSourceNode) {
            try {
                this.pcmSourceNode.onended = null;
                this.pcmSourceNode.stop();
            } catch (e) { /* ignore */ }
            this.pcmSourceNode.disconnect();
            this.pcmSourceNode = null;
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(e => console.warn("Error closing previous AudioContext", e));
        }
        this.audioContext = null;
        
        this.pcmBuffer = null;
        this.pcmPlayStartTime = 0;
        this.pcmCurrentOffset = 0;
    }

    private async _playPcmData(pcmData: Uint8Array) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new AudioContext();
        }

        if (!this.gainNode) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
        }

        const numberOfChannels = 2;
        const sampleRate = 44100;
        const bytesPerSamplePerChannel = 2;
        const totalSamplesPerChannel = pcmData.byteLength / (bytesPerSamplePerChannel * numberOfChannels);

        if (totalSamplesPerChannel === 0) {
            console.error("[FFMPEG] PCM data is empty.");
            this.onError?.(ErrorReason.EmptyResource, new Error("Decoded PCM data is empty."));
            this.playerState = PlayerState.None;
            return;
        }

        this.pcmBuffer = this.audioContext.createBuffer(numberOfChannels, totalSamplesPerChannel, sampleRate);
        const pcmInt16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);

        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = this.pcmBuffer.getChannelData(channel);
            for (let i = 0; i < totalSamplesPerChannel; i++) {
                channelData[i] = pcmInt16[i * numberOfChannels + channel] / 32768.0;
            }
        }
        await this._startPcmPlayback(this.pcmCurrentOffset);
    }

    private async _startPcmPlayback(offsetInSeconds = 0) {
        if (!this.pcmBuffer || !this.audioContext || this.audioContext.state === 'closed') {
            console.error("[FFMPEG] Cannot start PCM playback: buffer or context not ready.");
            this.playerState = PlayerState.None;
            return;
        }

        if (this.pcmSourceNode && this.gainNode) {
            this.pcmSourceNode.connect(this.gainNode);
        }

        if (this.pcmSourceNode) {
            this.pcmSourceNode.onended = null;
            try { this.pcmSourceNode.stop(); } catch(e) {/* ignore */}
            this.pcmSourceNode.disconnect();
        }

        this.pcmSourceNode = this.audioContext.createBufferSource();
        this.pcmSourceNode.buffer = this.pcmBuffer;
        if (this.gainNode) {
            this.pcmSourceNode.connect(this.gainNode);
        } else {
            this.pcmSourceNode.connect(this.audioContext.destination);
        }

        this.pcmSourceNode.onended = () => {
            if (this.playerState === PlayerState.Playing && this.正在使用FFmpeg) {
                if (this.audioContext && this.audioContext.state === 'running') {
                    const currentTime = this.pcmCurrentOffset + (this.audioContext.currentTime - this.pcmPlayStartTime);
                    if (currentTime >= this.pcmBuffer.duration - 0.1) {
                        this.pcmCurrentOffset = 0;
                        this.playerState = PlayerState.Paused;
                        this.onPlayerStateChanged?.(this.playerState);
                        this.onEnded?.();
                        this.cancelFFmpegProgressUpdate();
                    }
                } else if (!this.audioContext || this.audioContext.state === 'closed') {
                    this.pcmCurrentOffset = 0;
                    this.playerState = PlayerState.Paused;
                    this.onPlayerStateChanged?.(this.playerState);
                    this.onEnded?.();
                    this.cancelFFmpegProgressUpdate();
                }
            }
        };

        try {
            this.pcmCurrentOffset = offsetInSeconds;
            this.pcmSourceNode.start(0, this.pcmCurrentOffset);
            this.pcmPlayStartTime = this.audioContext.currentTime;

            this.playerState = PlayerState.Playing;
            if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
            this.cancelFFmpegProgressUpdate();
            this.updateFFmpegProgress();
        } catch (e) {
            console.error("[FFMPEG] Error starting PCM source node:", e);
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.UnsupportedResource, e);
        }
    }

    private cancelFFmpegProgressUpdate() {
        if (this.ffmpegProgressAnimationId !== null) {
            cancelAnimationFrame(this.ffmpegProgressAnimationId);
            this.ffmpegProgressAnimationId = null;
        }
    }

    private updateFFmpegProgress() {
        if (this.正在使用FFmpeg && this.playerState === PlayerState.Playing && 
            this.audioContext && this.pcmBuffer && this.pcmSourceNode && 
            this.audioContext.state === 'running') {
            
            const elapsedTimeSinceStart = this.audioContext.currentTime - this.pcmPlayStartTime;
            const currentPlaybackTime = this.pcmCurrentOffset + elapsedTimeSinceStart;
    
            if (currentPlaybackTime >= 0 && currentPlaybackTime <= this.pcmBuffer.duration) {
                try {
                    this.onProgressUpdate?.({ 
                        currentTime: currentPlaybackTime, 
                        duration: this.pcmBuffer.duration 
                    });
                } catch (e) {
                    console.error("Error in progress update callback:", e);
                }
            }
    
            // 继续更新进度
            this.ffmpegProgressAnimationId = requestAnimationFrame(() => this.updateFFmpegProgress());
        } else {
            this.cancelFFmpegProgressUpdate();
        }
    }


    private initHls(config?: Partial<HlsConfig>) {
        if (!this.hls) {
            this.hls = new Hls(config);
            this.hls.attachMedia(this.audio);
            this.hls.on(HlsEvents.ERROR, (_evt, errorData) => {
                this.onError?.(ErrorReason.EmptyResource, errorData);
            })
        }
    }

    private destroyHls() {
        if (this.hls) {
            this.hls.detachMedia();
            this.hls.off(HlsEvents.ERROR);
            this.hls.destroy();
            this.hls = null;
        }
    }

    destroy(): void {
        this.destroyHls();
        this.reset();
    }

    pause(): void {
        if (this.正在使用FFmpeg) {
            if (this.audioContext && this.audioContext.state === 'running' && this.pcmSourceNode) {
                const elapsedTimeInCurrentSegment = this.audioContext.currentTime - this.pcmPlayStartTime;
                this.pcmCurrentOffset += elapsedTimeInCurrentSegment;

                this.pcmSourceNode.onended = null;
                try { this.pcmSourceNode.stop(); } catch(e) { /* ignore */ }

                this.playerState = PlayerState.Paused;
                if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
                this.cancelFFmpegProgressUpdate();
            }
        } else {
             if (this.hasSource) {
                this.audio.pause();
            }
        }
    }

    play(): void {
        if (this.正在使用FFmpeg) {
            if (this.audioContext && this.pcmBuffer) {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        this._startPcmPlayback(this.pcmCurrentOffset);
                    }).catch(e => console.error("Error resuming AudioContext:", e));
                } else if (this.audioContext.state === 'running') {
                    if (!this.pcmSourceNode || (this.playerState === PlayerState.Paused && this.pcmCurrentOffset >= (this.pcmBuffer.duration - 0.01))) {
                         if (this.pcmCurrentOffset >= (this.pcmBuffer.duration - 0.01)) {
                            this.pcmCurrentOffset = 0;
                         }
                    }
                    this._startPcmPlayback(this.pcmCurrentOffset);
                }
            } else {
                console.warn("[FFMPEG] Play called but AudioContext or PCM buffer not ready.");
            }
        } else {
            if (this.hasSource) {
                this.audio.play().catch(e => {
                    console.error("HTMLAudioElement play() promise rejected:", e);
                });
            }
        }
    }

    reset(): void {
        this.playerState = PlayerState.None;
        this.audio.src = "";
        this.audio.removeAttribute("src");
        this.audio.load();
        this.musicItem = null;
        this.currentTrackSource = null;
        if (navigator.mediaSession) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = "none";
        }

        this.resetAudioContextAndSourceNode();
        this.正在使用FFmpeg = false;
        this.destroyHls();
    }

    seekTo(seconds: number): void {
        if (this.正在使用FFmpeg) {
            if (this.pcmBuffer && this.audioContext) {
                const newOffset = Math.max(0, Math.min(seconds, this.pcmBuffer.duration));
                const wasPlaying = this.playerState === PlayerState.Playing;

                this._startPcmPlayback(newOffset);

                if (!wasPlaying && this.playerState === PlayerState.Playing) {
                    this.pause();
                }
                try {
                    this.onProgressUpdate?.({ currentTime: newOffset, duration: this.pcmBuffer.duration });
                } catch (e) {
                    console.error("Error in progress update callback:", e);
                }
            }
        } else {
            if (this.hasSource && isFinite(seconds)) {
                const duration = this.audio.duration;
                this.audio.currentTime = Math.min(seconds, isNaN(duration) ? Infinity : duration);
            }
        }
    }

    setLoop(isLoop: boolean): void {
        this.audio.loop = isLoop;
        if (this.pcmSourceNode) {
            this.pcmSourceNode.loop = isLoop;
        }
    }

    async setSinkId(deviceId: string): Promise<void> {
        let success = false;
        if (this.正在使用FFmpeg && this.audioContext && (this.audioContext as any).setSinkId) {
            try {
                await (this.audioContext as any).setSinkId(deviceId);
                success = true;
                console.log("AudioContext sinkId set successfully.");
            } catch (e) {
                console.error("Failed to set sink ID for AudioContext:", e);
            }
        }

        if (!success && (this.audio as any).setSinkId) {
            try {
                await (this.audio as any).setSinkId(deviceId);
                console.log("HTMLAudioElement sinkId set successfully.");
            } catch (e) {
                console.error("Failed to set sink ID for HTMLAudioElement:", e);
                if (!this.正在使用FFmpeg) throw e;
            }
        }
    }


    setSpeed(speed: number): void {
        this.audio.playbackRate = speed;
        if (this.pcmSourceNode) {
            this.pcmSourceNode.playbackRate.value = speed;
        }
    }

    prepareTrack(musicItem: IMusic.IMusicItem) {
        this.reset();
        this.musicItem = {...musicItem};

        if (navigator.mediaSession) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: musicItem.title,
                artist: musicItem.artist,
                album: musicItem.album,
                artwork: [ { src: musicItem.artwork ?? albumImg } ],
            });
            navigator.mediaSession.playbackState = "none";
        }
        this.playerState = PlayerState.None;
    }

    setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): void {
        if (!this.musicItem || this.musicItem.id !== musicItem.id || this.musicItem.platform !== musicItem.platform || this.currentTrackSource?.url !== trackSource.url) {
             this.prepareTrack(musicItem);
        } else {
            this.resetAudioContextAndSourceNode();
            this.audio.removeAttribute('src');
            this.audio.load();
            this.正在使用FFmpeg = false;
        }

        this.currentTrackSource = trackSource;
        let urlToPlay = trackSource.url;

        if (!urlToPlay) {
            this.onError?.(ErrorReason.EmptyResource, new Error("Track source URL is missing."));
            this.playerState = PlayerState.None;
            return;
        }

        const urlObj = new URL(urlToPlay);
        let requestHeaders: Record<string, any> | null = null;
        if (trackSource.headers || trackSource.userAgent) {
            requestHeaders = {...(trackSource.headers ?? {})};
            if (trackSource.userAgent) requestHeaders["user-agent"] = trackSource.userAgent;
        }
        if (urlObj.username && urlObj.password) {
            const authHeader = `Basic ${btoa(`${decodeURIComponent(urlObj.username)}:${decodeURIComponent(urlObj.password)}`)}`;
            urlObj.username = ""; urlObj.password = "";
            requestHeaders = { ...(requestHeaders || {}), Authorization: authHeader };
            urlToPlay = urlObj.toString();
        }
        if (requestHeaders) {
            const forwardedUrl = ServiceManager.RequestForwarderService.forwardRequest(urlToPlay, "GET", requestHeaders);
            if (forwardedUrl) {
                urlToPlay = forwardedUrl;
                requestHeaders = null;
            } else if (!requestHeaders["Authorization"]) {
                urlToPlay = encodeUrlHeaders(urlToPlay, requestHeaders);
                requestHeaders = null;
            }
        }

        if (!urlToPlay) {
            this.onError?.(ErrorReason.EmptyResource, new Error("url is empty after processing headers."));
            this.playerState = PlayerState.None;
            return;
        }

        this.playerState = PlayerState.Buffering;
        if (getUrlExt(trackSource.url) === ".m3u8") {
            if (Hls.isSupported()) {
                this.destroyHls();
                this.initHls();
                this.hls!.loadSource(urlToPlay);
            } else {
                this.onError?.(ErrorReason.UnsupportedResource, new Error("HLS not supported."));
                this.playerState = PlayerState.None;
                return;
            }
        } else if (requestHeaders) {
            fetch(urlToPlay, { method: "GET", headers: requestHeaders })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`Fetch failed with headers: ${res.status} ${res.statusText}`);
                    const blob = await res.blob();
                    if (isSameMedia(this.musicItem, musicItem) && this.currentTrackSource === trackSource) {
                        this.audio.src = URL.createObjectURL(blob);
                    } else {
                        URL.revokeObjectURL(URL.createObjectURL(blob));
                    }
                })
                .catch(async e => {
                    console.warn("Fetch with headers failed, trying FFmpeg as fallback:", e);
                    if (isSameMedia(this.musicItem, musicItem) && this.currentTrackSource === trackSource) {
                        this.正在使用FFmpeg = true;
                        this.playerState = PlayerState.Buffering;
                        try {
                            await this.tryDecodeAndPlayWithFFmpeg(trackSource, musicItem);
                        } catch (ffmpegError) {
                            console.error("FFmpeg playback failed after fetch error:", ffmpegError);
                            this.playerState = PlayerState.None;
                            this.onError?.(ErrorReason.UnsupportedResource, ffmpegError);
                            this.正在使用FFmpeg = false;
                        }
                    }
                });
        } else {
            this.audio.src = urlToPlay;
        }
    }

    setVolume(volume: number): void {
        this.audio.volume = volume;
        if (this.正在使用FFmpeg && this.gainNode) {
            this.gainNode.gain.value = volume;
        }
    }
}

export default AudioController;