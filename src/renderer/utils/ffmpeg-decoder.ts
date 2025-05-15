// src/renderer/utils/ffmpeg-decoder.ts
import { FFmpeg, FileData } from '@ffmpeg/ffmpeg';
import { fetchFile } from './fetch-file-helper';
import { getGlobalContext } from "@shared/global-context/renderer";
import { fsUtil } from "@shared/utils/renderer";
import { getMediaPrimaryKey } from '@/common/media-util'; // 确保导入，如果你要在外部使用

const ffmpeg = new FFmpeg();

ffmpeg.on('log', (e) => {
  console.log(`[FFmpeg log]: ${e.type} - ${e.message}`);
});
ffmpeg.on('progress', (p) => {
  console.log('[FFmpeg progress]:', p);
});

let isLoaded = false;
const decodeCache = new Map<string, string>();

async function createBlobURLFromLocalFile(filePath: string, type: string): Promise<string> {
  try {
    console.log(`[FFmpeg Decoder] Reading local file for Blob URL: ${filePath}`);
    const fileContent = await fsUtil.readFile(filePath, null); // 假设返回 ArrayBuffer
    if (!fileContent || (fileContent as ArrayBuffer).byteLength === 0) {
      throw new Error(`File content is empty or null for ${filePath}`);
    }
    const blob = new Blob([fileContent as ArrayBuffer], { type });
    const blobUrl = URL.createObjectURL(blob);
    console.log(`[FFmpeg Decoder] Created Blob URL for ${filePath}: ${blobUrl.substring(0, 100)}...`); // 只打印部分 URL
    return blobUrl;
  } catch (error) {
    console.error(`[FFmpeg Decoder] Error creating Blob URL from ${filePath}:`, error);
    throw error;
  }
}

export function clearDecodeCacheKey(key: string) {
  const pcmUrl = decodeCache.get(key);
  if (pcmUrl) {
    URL.revokeObjectURL(pcmUrl);
    decodeCache.delete(key);
    console.log(`[FFmpeg Decoder] Cleared cache for key: ${key}`);
  }
}

export async function decodeAudioWithFFmpeg(
  urlOrData: string | Uint8Array,
  stableCacheKey?: string
): globalThis.Promise<string> {
  const internalCacheKey = stableCacheKey || (typeof urlOrData === 'string' ? urlOrData : `data-${urlOrData.byteLength}`);
  console.log(`[decodeAudioWithFFmpeg] 请求解码, 缓存键: ${internalCacheKey}`);

  if (decodeCache.has(internalCacheKey)) {
    console.log(`[decodeAudioWithFFmpeg] 从缓存返回 PCM URL for: ${internalCacheKey}`);
    return decodeCache.get(internalCacheKey)!;
  }

  if (!isLoaded) {
    console.log('[decodeAudioWithFFmpeg] FFmpeg 未加载，开始加载...');
    const ffmpegAssetsBasePath = `${getGlobalContext().appPath.res}/.ffmpeg-assets`;
    console.log(`[decodeAudioWithFFmpeg] FFmpeg assets 本地文件基础路径: ${ffmpegAssetsBasePath}`);

    const coreURLPath = window.path.join(ffmpegAssetsBasePath, 'ffmpeg-core.js');
    const wasmURLPath = window.path.join(ffmpegAssetsBasePath, 'ffmpeg-core.wasm');
    const classWorkerURLPath = window.path.join(ffmpegAssetsBasePath, 'ffmpeg-main.worker.js');

    try {
      console.log(`[decodeAudioWithFFmpeg] 准备加载核心文件为 Blob URL...`);
      const coreBlobURL = await createBlobURLFromLocalFile(coreURLPath, 'application/javascript');
      const wasmBlobURL = await createBlobURLFromLocalFile(wasmURLPath, 'application/wasm');
      const classWorkerBlobURL = await createBlobURLFromLocalFile(classWorkerURLPath, 'application/javascript');

      console.log(`[decodeAudioWithFFmpeg] coreBlobURL (first 100 chars): ${coreBlobURL.substring(0,100)}...`);
      console.log(`[decodeAudioWithFFmpeg] wasmBlobURL (first 100 chars): ${wasmBlobURL.substring(0,100)}...`);
      console.log(`[decodeAudioWithFFmpeg] classWorkerBlobURL (first 100 chars): ${classWorkerBlobURL.substring(0,100)}...`);

      await ffmpeg.load({
        coreURL: coreBlobURL,
        wasmURL: wasmBlobURL,
        classWorkerURL: classWorkerBlobURL,
      });
      console.log('[decodeAudioWithFFmpeg] FFmpeg 加载成功!');
      isLoaded = true;
    } catch (error) {
      console.error('[decodeAudioWithFFmpeg] FFmpeg 加载失败:', error);
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
        console.log(`[decodeAudioWithFFmpeg] FFmpeg: 准备通过 fetchFile 获取网络文件内容: ${urlOrData}`);
        fileDataInstance = await fetchFile(urlOrData); // fetchFile 用于网络 URL
         if (!fileDataInstance || fileDataInstance.byteLength === 0) {
            console.error(`[decodeAudioWithFFmpeg] fetchFile 未能获取到有效数据 for URL: ${urlOrData}`);
            throw new Error(`fetchFile returned empty data for ${urlOrData}`);
        }
    } else {
        fileDataInstance = urlOrData; // 如果已经是 Uint8Array (例如本地文件读取后)
    }
    console.log(`[decodeAudioWithFFmpeg] 获取数据大小: ${fileDataInstance?.byteLength}`);

    console.log(`[decodeAudioWithFFmpeg] FFmpeg: 准备写入文件 ${inputFileName}`);
    await ffmpeg.writeFile(inputFileName, fileDataInstance);
    console.log(`[decodeAudioWithFFmpeg] FFmpeg: 文件写入完成 ${inputFileName}, 开始执行解码...`);
    await ffmpeg.exec(['-i', inputFileName, '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-f', 'wav', outputFileName]);
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
    console.log(`[decodeAudioWithFFmpeg] 生成 PCM URL: ${pcmUrl.substring(0,100)}...`);

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