// src/renderer/utils/ffmpeg-decoder.ts
import { FFmpeg, FileData } from '@ffmpeg/ffmpeg';
import { fetchFile } from './fetch-file-helper';
import { getGlobalContext } from "@shared/global-context/renderer";

const ffmpeg = new FFmpeg();

ffmpeg.on('log', (e) => {
  // 你可以根据需要过滤日志，例如只显示错误或关键信息
  // if (e.type === 'fferr' || e.message.includes('Input') || e.message.includes('Output')) {
  console.log(`[FFmpeg log]: ${e.type} - ${e.message}`);
  // }
});
ffmpeg.on('progress', (p) => {
  console.log('[FFmpeg progress]:', p);
});


let isLoaded = false;
const decodeCache = new Map<string, string>();

export async function decodeAudioWithFFmpeg(urlOrData: string | Uint8Array): globalThis.Promise<string> {
  const cacheKey = typeof urlOrData === 'string' ? urlOrData : `data-${urlOrData.byteLength}`; // 简单生成缓存键
  console.log(`[decodeAudioWithFFmpeg] 请求解码: ${typeof urlOrData === 'string' ? urlOrData : `Uint8Array (size: ${urlOrData.byteLength})`}`);

  if (decodeCache.has(cacheKey)) {
    console.log(`[decodeAudioWithFFmpeg] 从缓存返回 PCM URL for: ${cacheKey}`);
    return decodeCache.get(cacheKey)!;
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
        // 如果使用的是单线程 @ffmpeg/core，则不需要 workerURL
        // 如果使用的是多线程 @ffmpeg/core-mt，你需要确保相应的 worker 文件 (例如 ffmpeg-core-mt.worker.js)
        // 存在于 ffmpegAssetsPath下，并取消注释下面这行：
        // workerURL: `${ffmpegAssetsPath}/ffmpeg-core-mt.worker.js`,
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

    // 清理 FFmpeg 虚拟文件系统中的文件
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    console.log('[decodeAudioWithFFmpeg] 清理虚拟文件系统中的临时文件');

    decodeCache.set(cacheKey, pcmUrl);
    return pcmUrl;
  } catch (error) {
    console.error('[decodeAudioWithFFmpeg] FFmpeg 解码或文件操作失败:', error);
    throw error;
  }
}