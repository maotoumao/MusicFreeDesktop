/**
 * themepack — 辅助窗口 Preload 层
 *
 * 极简实现：
 * - 启动时从 localStorage 读取缓存的 CSS 并同步注入
 * - 监听主题切换广播，重新加载缓存中的 CSS
 *
 * 不处理 iframe、blurHash、安装卸载等逻辑。
 * 辅助窗口无需调用任何 themepack API。
 *
 * 前提：Electron 中所有窗口共享同一 session/partition，
 * 因此 localStorage 在主窗口和辅助窗口之间是共享的。
 */
import { ipcRenderer } from 'electron';
import { THEMEPACK_STORAGE_KEY, THEMEPACK_STYLE_NODE_ID, IPC } from '../common/constant';

/**
 * 从 localStorage 读取缓存的 CSS 并注入到 <style> 节点。
 * 如果无缓存则移除已有的 <style> 节点。
 */
function injectCssFromCache(): void {
    let styleNode = document.getElementById(THEMEPACK_STYLE_NODE_ID) as HTMLStyleElement | null;

    const raw = localStorage.getItem(THEMEPACK_STORAGE_KEY);
    if (!raw) {
        styleNode?.remove();
        return;
    }

    try {
        const cache = JSON.parse(raw);
        if (!styleNode) {
            styleNode = document.createElement('style');
            styleNode.id = THEMEPACK_STYLE_NODE_ID;
            document.head.appendChild(styleNode);
        }
        styleNode.textContent = cache.css || '';
    } catch {
        styleNode?.remove();
    }
}

// ── 同步阶段：preload 加载时立即注入缓存的 CSS ──
injectCssFromCache();

// ── 监听主题切换广播 → 重新注入 ──
ipcRenderer.on(IPC.THEME_SWITCHED, () => {
    injectCssFromCache();
});
