import { createFFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({
  log: false,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js'
});

let isLoaded = false;
const decodeCache = new Map<string, string>();

export async function decodeAudioWithFFmpeg(url: string): Promise<string> {
  if (decodeCache.has(url)) return decodeCache.get(url)!;

  if (!isLoaded) {
    await ffmpeg.load();
    isLoaded = true;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');

    const arrayBuffer = await response.arrayBuffer();
    // const blob = new Blob([arrayBuffer], { // fetchFile 应该可以直接处理 ArrayBuffer
    //   type: response.headers.get('content-type') || 'application/octet-stream'
    // });
    const fileName = 'input' + (url.split('.').pop() || '.unknown'); // 确保文件名有扩展名

    ffmpeg.FS('writeFile', fileName, new Uint8Array(arrayBuffer));
    await ffmpeg.run('-i', fileName, '-f', 'wav', 'output.wav'); // -f wav 指定输出格式

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
