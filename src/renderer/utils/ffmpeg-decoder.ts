import { FFmpeg } from '@ffmpeg/ffmpeg'; // 修改为默认导入 FFmpeg 类
import { fetchFile } from './fetch-file-helper'; // 假设你将 fetchFile 放到一个辅助文件中

const ffmpeg = new FFmpeg(); // 使用 new FFmpeg() 创建实例

ffmpeg.on('log', (e) => { // 移动日志监听器到实例创建后
  console.log(e.message);
});

let isLoaded = false;
const decodeCache = new Map<string, string>();

export async function decodeAudioWithFFmpeg(url: string): globalThis.Promise<string> {
  if (decodeCache.has(url)) return decodeCache.get(url)!;

  if (!isLoaded) {
    messageText.value = '加载ffmpeg-core.js'; // 假设 messageText 在此上下文中不可用，可以考虑移除或用其他方式提示
    await ffmpeg.load({ // load 方法现在是实例方法
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js', // 与你的 audio-controller.ts 保持一致
      // wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.wasm' // 可选
    });
    isLoaded = true;
  }

  try {
    const fileName = 'input' + (url.split('.').pop() || '.unknown');

    await ffmpeg.writeFile(fileName, await fetchFile(url)); // 使用辅助函数 fetchFile
    await ffmpeg.exec(['-i', fileName, '-f', 'wav', 'output.wav']); // exec 方法现在是实例方法

    const data = await ffmpeg.readFile('output.wav'); // readFile 方法现在是实例方法
    const pcmBlob = new Blob([data.buffer], { type: 'audio/wav' });
    const pcmUrl = URL.createObjectURL(pcmBlob);

    decodeCache.set(url, pcmUrl);
    return pcmUrl;
  } catch (error) {
    console.error('FFmpeg 解码失败:', error);
    throw error;
  }
}
