import { FFmpeg } from '@ffmpeg/ffmpeg'; // 使用 { FFmpeg } 导入

const ffmpeg = new FFmpeg(); // 使用 new FFmpeg() 创建实例
let isLoaded = false;
const decodeCache = new Map<string, string>();

export async function decodeAudioWithFFmpeg(url: string): Promise<string> {
  if (decodeCache.has(url)) return decodeCache.get(url)!;

  if (!isLoaded) {
    await ffmpeg.load({ // 配置在 load 方法中传入
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
      // log: false, // FFmpeg 实例的 log 属性似乎不是这样配置，通常在 load 或 run 时控制
    });
    isLoaded = true;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');

    const arrayBuffer = await response.arrayBuffer();
    const fileName = 'input' + (url.split('.').pop() || '.unknown');

    ffmpeg.FS('writeFile', fileName, new Uint8Array(arrayBuffer));
    await ffmpeg.run('-i', fileName, '-f', 'wav', 'output.wav');

    const data = ffmpeg.FS('readFile', 'output.wav');
    const pcmBlob = new Blob([data.buffer], { type: 'audio/wav' });
    const pcmUrl = URL.createObjectURL(pcmBlob);

    decodeCache.set(url, pcmUrl);
    return pcmUrl;
  } catch (error) {
    console.error('FFmpeg 解码失败:', error);
    throw error;
  }
}
