/**
 * Win7 兼容 Polyfills
 *
 * Electron 22 使用 Node.js 16，部分全局变量尚未提供。
 * CI 构建 Win7 版本时，此文件会替换 index.ts。
 */

// Node 16 中 Blob 不是全局变量（Node 18+ 才提升为全局），
// 但 undici（axios 的底层依赖）在模块初始化时引用 Blob。
if (typeof globalThis.Blob === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    globalThis.Blob = require('buffer').Blob;
}
