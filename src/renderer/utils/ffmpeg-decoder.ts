// src/renderer/utils/ffmpeg-decoder.ts
import { FFmpeg, FileData } from '@ffmpeg/ffmpeg';
import { fetchFile } from './fetch-file-helper';
import { getGlobalContext } from "@shared/global-context/renderer";
import { fsUtil } from "@shared/utils/renderer"; // 确保 fsUtil 已正确暴露并可用

const ffmpeg = new FFmpeg();

ffmpeg.on('log', ({ message }) => console.log('[FFmpeg log]:', message));
ffmpeg.on('progress', (p) => console.log('[FFmpeg progress]:', p));

let isLoaded = false;
const decodeCache = new Map<string, string>();

// 用于从本地文件系统路径创建 Blob URL
async function createBlobURLFromLocalPath(localPath: string, mimeType: string): Promise<string> {
  try {
    console.log(`[FFmpeg Decoder] Reading local file to create Blob URL: ${localPath}`);
    // fsUtil.readFile 应该返回 ArrayBuffer 或 Buffer
    const fileContent = await fsUtil.readFile(localPath, null);
    if (!fileContent || (fileContent as ArrayBuffer).byteLength === 0) {
      throw new Error(`File content is empty for ${localPath}`);
    }
    const blob = new Blob([fileContent as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    console.log(`[FFmpeg Decoder] Created Blob URL for ${localPath.substring(localPath.lastIndexOf('/') + 1)}`);
    return url;
  } catch (error) {
    console.error(`[FFmpeg Decoder] Failed to create Blob URL from ${localPath}:`, error);
    throw error;
  }
}

export function clearDecodeCacheKey(key: string) {
  const pcmUrl = decodeCache.get(key);
  if (pcmUrl) {
    URL.revokeObjectURL(pcmUrl);
    decodeCache.delete(key);
    console.log(`[FFmpeg Decoder] Cleared FFmpeg cache for key: ${key}`);
  }
}

export async function decodeAudioWithFFmpeg(
  urlOrData: string | Uint8Array,
  stableCacheKey?: string
): globalThis.Promise<string> {
  const internalCacheKey = stableCacheKey || (typeof urlOrData === 'string' ? urlOrData : `data-${urlOrData.byteLength}-${Math.random()}`); // 为 Uint8Array 添加随机部分避免键冲突
  console.log(`[decodeAudioWithFFmpeg] 请求解码, 内部缓存键: ${internalCacheKey}`);

  if (decodeCache.has(internalCacheKey)) {
    console.log(`[decodeAudioWithFFmpeg] 从缓存返回 PCM URL for: ${internalCacheKey}`);
    return decodeCache.get(internalCacheKey)!;
  }

  if (!isLoaded) {
    console.log('[decodeAudioWithFFmpeg] FFmpeg 未加载，开始加载...');
    // getGlobalContext().appPath.res 应该返回类似 'D:\Program Files (x86)\MusicFree\resources\res' 的路径
    const ffmpegAssetsDiskPath = window.path.join(getGlobalContext().appPath.res, '.ffmpeg-assets');
    console.log(`[decodeAudioWithFFmpeg] FFmpeg assets 本地磁盘路径: ${ffmpegAssetsDiskPath}`);

    const coreJSPath = window.path.join(ffmpegAssetsDiskPath, 'ffmpeg-core.js');
    const coreWasmPath = window.path.join(ffmpegAssetsDiskPath, 'ffmpeg-core.wasm');
    // 这个是 @ffmpeg/ffmpeg 包的 Web Worker 脚本，不是 @ffmpeg/core 的
    const classWorkerPath = window.path.join(ffmpegAssetsDiskPath, 'ffmpeg-main.worker.js'); 
                                          // ^^^ 确保这个文件名和 res/.ffmpeg-assets/ 下的文件名一致

    try {
      console.log(`[decodeAudioWithFFmpeg] 准备从本地路径创建 Blob URL...`);
      const coreBlobURL = await createBlobURLFromLocalPath(coreJSPath, 'application/javascript');
      const wasmBlobURL = await createBlobURLFromLocalPath(coreWasmPath, 'application/wasm');
      const classWorkerBlobURL = await createBlobURLFromLocalPath(classWorkerPath, 'application/javascript');

      console.log(`[decodeAudioWithFFmpeg] coreBlobURL created.`);
      console.log(`[decodeAudioWithFFmpeg] wasmBlobURL created.`);
      console.log(`[decodeAudioWithFFmpeg] classWorkerBlobURL created.`);
      
      // 对于单线程 @ffmpeg/core，不需要 workerURL 参数
      // 如果使用 @ffmpeg/core-mt (多线程), 则需要提供其对应的 worker.js 的 Blob URL 给 workerURL
      await ffmpeg.load({
        coreURL: coreBlobURL,
        wasmURL: wasmBlobURL,
        classWorkerURL: classWorkerBlobURL, // 这是 @ffmpeg/ffmpeg 包的 worker
      });
      console.log('[decodeAudioWithFFmpeg] FFmpeg 加载成功!');
      isLoaded = true;
    } catch (error) {
      console.error('[decodeAudioWithFFmpeg] FFmpeg 加载失败:', error);
      isLoaded = false; //确保加载失败后状态正确
      throw error;
    }
  } else {
    console.log('[decodeAudioWithFFmpeg] FFmpeg 已加载.');
  }

  try {
    const inputFileName = 'input' + (typeof urlOrData === 'string' ? (urlOrData.substring(urlOrData.lastIndexOf('.')) || '.unknown') : `.${Math.random().toString(36).substring(7)}.tmp`);
    const outputFileName = 'output.wav';

    let fileDataInstance: Uint8Array;
    if (typeof urlOrData === 'string') {
        console.log(`[decodeAudioWithFFmpeg] FFmpeg: 准备通过 fetchFile 获取网络文件内容: ${urlOrData}`);
        fileDataInstance = await fetchFile(urlOrData);
         if (!fileDataInstance || fileDataInstance.byteLength === 0) {
            console.error(`[decodeAudioWithFFmpeg] fetchFile 未能获取到有效数据 for URL: ${urlOrData}`);
            throw new Error(`fetchFile returned empty data for ${urlOrData}`);
        }
    } else {
        fileDataInstance = urlOrData;
    }
    console.log(`[decodeAudioWithFFmpeg] 输入数据大小: ${fileDataInstance?.byteLength}`);

    console.log(`[decodeAudioWithFFmpeg] FFmpeg: 准备写入文件 ${inputFileName}`);
    await ffmpeg.writeFile(inputFileName, fileDataInstance);
    console.log(`[decodeAudioWithFFmpeg] FFmpeg: 文件写入完成 ${inputFileName}, 开始执行解码...`);
    // PCM s16le 是 WAV 文件中常见的未压缩音频格式
    await ffmpeg.exec([
      '-i', inputFileName,
      '-vn', '-sn', // 禁用视频和字幕
      '-acodec', 'pcm_s16le', // 强制使用 PCM 16-bit
      '-ar', '44100', // 采样率
      '-ac', '2', // 声道数
      '-f', 'wav',
      outputFileName
    ]);
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
    console.log(`[decodeAudioWithFFmpeg] 生成 PCM Blob URL.`);

    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    console.log('[decodeAudioWithFFmpeg] 清理 FFmpeg 虚拟文件系统中的临时文件');

    decodeCache.set(internalCacheKey, pcmUrl);
    return pcmUrl;
  } catch (error) {
    console.error('[decodeAudioWithFFmpeg] FFmpeg 解码或文件操作失败:', error);
    throw error;
  }
}