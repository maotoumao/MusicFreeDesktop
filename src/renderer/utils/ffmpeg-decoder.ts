import { FFmpeg, FileData } from '@ffmpeg/ffmpeg'; // 导入 FFmpeg 类 和 FileData 类型
import { fetchFile } from './fetch-file-helper';

const ffmpeg = new FFmpeg();

ffmpeg.on('log', (e) => {
  console.log(e.message);
});

let isLoaded = false;
const decodeCache = new Map<string, string>();

export async function decodeAudioWithFFmpeg(url: string): globalThis.Promise<string> {
  if (decodeCache.has(url)) return decodeCache.get(url)!;

  if (!isLoaded) {
    // messageText.value = '加载ffmpeg-core.js'; // 移除或替换此行
    console.log('加载ffmpeg-core.js'); // 使用 console.log 替代
    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'
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
      // 如果 data 是 string，理论上不应该发生在这里，因为我们明确输出了 wav
      // 但为了类型安全，可以做一个处理或抛出错误
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
