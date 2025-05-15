// src/renderer/utils/ffmpeg-decoder.ts
import { FFmpeg, FileData } from '@ffmpeg/ffmpeg';
import { fetchFile } from './fetch-file-helper';
import { getGlobalContext } from "@shared/global-context/renderer";

const ffmpeg = new FFmpeg();

ffmpeg.on('log', (e) => {
  console.log(`[FFmpeg log]: ${e.type} - ${e.message}`);
});
ffmpeg.on('progress', (p) => {
  console.log('[FFmpeg progress]:', p);
});

let isLoaded = false;
// 导出 decodeCache
export const decodeCache = new Map<string, string>();

export function clearDecodeCacheKey(key: string) {
  const pcmUrl = decodeCache.get(key);
  if (pcmUrl) {
    URL.revokeObjectURL(pcmUrl);
    decodeCache.delete(key);
    console.log(`[FFmpeg Decoder] Cleared cache for key: ${key}`);
  }
}

export function clearAllDecodeCache() {
  decodeCache.forEach((url) => URL.revokeObjectURL(url));
  decodeCache.clear();
  console.log('[FFmpeg Decoder] All decode cache cleared.');
}


export async function decodeAudioWithFFmpeg(
  urlOrData: string | Uint8Array,
  stableCacheKey?: string // 接收一个稳定的缓存键
): globalThis.Promise<string> {
  const internalCacheKey = stableCacheKey || (typeof urlOrData === 'string' ? urlOrData : `data-${urlOrData.byteLength}`);
  console.log(`[decodeAudioWithFFmpeg] 请求解码, 缓存键: ${internalCacheKey}`);

  if (decodeCache.has(internalCacheKey)) {
    console.log(`[decodeAudioWithFFmpeg] 从缓存返回 PCM URL for: ${internalCacheKey}`);
    return decodeCache.get(internalCacheKey)!;
  }

  if (!isLoaded) {
    console.log('[decodeAudioWithFFmpeg] FFmpeg 未加载，开始加载...');
    const ffmpegAssetsPath = `file://${getGlobalContext().appPath.res}/.ffmpeg-assets`;
    console.log(`[decodeAudioWithFFmpeg] FFmpeg assets 基础路径: ${ffmpegAssetsPath}`);

    const coreURL = `${ffmpegAssetsPath}/ffmpeg-core.js`;
    const wasmURL = `${ffmpegAssetsPath}/ffmpeg-core.wasm`;
    const classWorkerURL = `${ffmpegAssetsPath}/ffmpeg-main.worker.js`;

    console.log(`[decodeAudioWithFFmpeg] coreURL: ${coreURL}`);
    console.log(`[decodeAudioWithFFmpeg] wasmURL: ${wasmURL}`);
    console.log(`[decodeAudioWithFFmpeg] classWorkerURL (for FFmpeg.exec): ${classWorkerURL}`);

    try {
      await ffmpeg.load({
        coreURL: coreURL,
        wasmURL: wasmURL,
        classWorkerURL: classWorkerURL,
      });
      console.log('[decodeAudioWithFFmpeg] FFmpeg 加载成功!');
      isLoaded = true;
    } catch (error) {
      console.error('[decodeAudioWithFFmpeg] FFmpeg 加载失败:', error);
      if (error.name === 'NetworkError' || error.message.includes('fetch')) {
          console.error('[decodeAudioWithFFmpeg] FFmpeg 核心文件网络加载错误，请检查路径和CSP设置。');
      }
      throw error;
    }
  } else {
    console.log('[decodeAudioWithFFmpeg] FFmpeg 已加载.');
  }

  try {
    const inputFileName = 'input' + (typeof urlOrData === 'string' ? (urlOrData.substring(urlOrData.lastIndexOf('.')) || '.unknown') : '.bin');
    const outputFileName = 'output.wav';

    let fileDataInstance: Uint8Array;
    if (typeof urlOrData === 'string') {
        console.log(`[decodeAudioWithFFmpeg] FFmpeg: 准备通过 fetchFile 获取文件内容: ${urlOrData}`);
        fileDataInstance = await fetchFile(urlOrData);
         if (!fileDataInstance || fileDataInstance.byteLength === 0) {
            console.error(`[decodeAudioWithFFmpeg] fetchFile未能获取到有效数据 for URL: ${urlOrData}`);
            throw new Error(`fetchFile returned empty data for ${urlOrData}`);
        }
    } else {
        fileDataInstance = urlOrData;
    }
    console.log(`[decodeAudioWithFFmpeg] 获取数据大小: ${fileDataInstance?.byteLength}`);

    console.log(`[decodeAudioWithFFmpeg] FFmpeg: 准备写入文件 ${inputFileName}`);
    await ffmpeg.writeFile(inputFileName, fileDataInstance);
    console.log(`[decodeAudioWithFFmpeg] FFmpeg: 文件写入完成 ${inputFileName}, 开始执行解码...`);
    await ffmpeg.exec(['-i', inputFileName, '-c:a', 'pcm_s16le', '-f', 'wav', outputFileName]);
    console.log('[decodeAudioWithFFmpeg] FFmpeg: 解码完成, 准备读取输出文件.');

    const dataOutput: FileData = await ffmpeg.readFile(outputFileName);
    let pcmBlob: Blob;
    if (dataOutput instanceof Uint8Array) {
      pcmBlob = new Blob([dataOutput.buffer], { type: 'audio/wav' });
    } else {
      console.error('[decodeAudioWithFFmpeg] FFmpeg readFile 没有返回 Uint8Array (WAV)');
      throw new Error('Unexpected data type from ffmpeg.readFile');
    }
    const pcmUrl = URL.createObjectURL(pcmBlob);
    console.log(`[decodeAudioWithFFmpeg] 生成 PCM URL: ${pcmUrl}`);

    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    console.log('[decodeAudioWithFFmpeg] 清理虚拟文件系统中的临时文件');

    decodeCache.set(internalCacheKey, pcmUrl);
    return pcmUrl;
  } catch (error) {
    console.error('[decodeAudioWithFFmpeg] FFmpeg 解码或文件操作失败:', error);
    throw error;
  }
}