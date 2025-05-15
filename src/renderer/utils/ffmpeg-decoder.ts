import { FFmpeg, FileData } from '@ffmpeg/ffmpeg';
import { fetchFile } from './fetch-file-helper';
import { getGlobalContext } from "@shared/global-context/renderer"; // 新增导入

const ffmpeg = new FFmpeg();

ffmpeg.on('log', (e) => {
  console.log(e.message);
});

let isLoaded = false;
const decodeCache = new Map<string, string>();

export async function decodeAudioWithFFmpeg(url: string): globalThis.Promise<string> {
  if (decodeCache.has(url)) return decodeCache.get(url)!;

  if (!isLoaded) {
    console.log('加载ffmpeg-core.js');
    const ffmpegAssetsPath = `file://${getGlobalContext().appPath.res}/.ffmpeg-assets`;
    await ffmpeg.load({
      coreURL: `${ffmpegAssetsPath}/ffmpeg-core.js`,
      wasmURL: `${ffmpegAssetsPath}/ffmpeg-core.wasm`,
      // workerURL: `${ffmpegAssetsPath}/ffmpeg-core-mt.worker.js`, // 如果使用多线程核心
      classWorkerURL: `${ffmpegAssetsPath}/ffmpeg-main.worker.js`
    });
    isLoaded = true;
  }

  try {
    const fileName = 'input' + (url.split('.').pop() || '.unknown');

    await ffmpeg.writeFile(fileName, await fetchFile(url));
    await ffmpeg.exec(['-i', fileName, '-f', 'wav', 'output.wav']);

    const data: FileData = await ffmpeg.readFile('output.wav');
    let pcmBlob: Blob;
    if (data instanceof Uint8Array) {
      pcmBlob = new Blob([data.buffer], { type: 'audio/wav' });
    } else {
      console.error('FFmpeg readFile did not return Uint8Array for WAV output');
      throw new Error('Unexpected data type from ffmpeg.readFile');
    }
    const pcmUrl = URL.createObjectURL(pcmBlob);

    decodeCache.set(url, pcmUrl);
    return pcmUrl;
  } catch (error) {
    console.error('FFmpeg 解码失败:', error);
    throw error;
  }
}