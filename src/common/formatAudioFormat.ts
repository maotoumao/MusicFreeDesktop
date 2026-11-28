import type { IAudioFormat } from '@appTypes/infra/localMusic';

/** 44100 → 44.1，48000 → 48 */
function toKHz(sampleRate: number): string {
    return String(Math.round(sampleRate / 100) / 10);
}

/**
 * 编码参数 → 简短音质描述：
 * 无损显示位深与采样率（FLAC 24bit/96kHz），有损显示码率（MP3 320kbps），缺少参数时只显示编码。
 */
export default function formatAudioFormat(format: IAudioFormat): string {
    const { codec = '', lossless, bitsPerSample, sampleRate, bitrate } = format;
    if (lossless && bitsPerSample && sampleRate) {
        return `${codec} ${bitsPerSample}bit/${toKHz(sampleRate)}kHz`.trim();
    }
    if (bitrate) {
        return `${codec} ${Math.round(bitrate / 1000)}kbps`.trim();
    }
    return codec;
}
