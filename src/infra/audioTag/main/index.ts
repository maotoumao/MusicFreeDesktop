/**
 * audioTag — 音频文件标签写入服务（仅主进程层，无 preload / renderer）
 *
 * 对外只暴露 IAudioTagWriter，第三方库只出现在 backends/ 下的具体实现里：
 * 替换实现时新增一个后端并修改 backends/index.ts 的导出即可。
 * Win7 版（Electron 22）构建时 backends/index.win7.ts 覆盖 index.ts，换成不写入的空实现。
 */
import type { IAudioTagWriter } from '@appTypes/infra/audioTag';
import backend from './backends';

const audioTag: IAudioTagWriter = backend;
export default audioTag;
