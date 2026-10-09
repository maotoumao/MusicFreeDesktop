/**
 * Deep Link 处理模块
 *
 * 处理 musicfree:// 协议链接，目前支持：
 * - musicfree://install/<pluginUrl> — 安装插件（支持逗号分隔批量安装）
 * - musicfree://install?plugin=<pluginUrl> — 同上（query 参数形式）
 */

import pluginManager from '@infra/pluginManager/main';
import logger from '@infra/logger/main';

/**
 * 处理 deep link URL。
 * 应在窗口创建完成、infra 初始化完毕后调用。
 */
export function handleDeepLink(url: string): void {
    if (!url) return;

    try {
        const urlObj = new URL(url);
        if (urlObj.protocol === 'musicfree:') {
            handleMusicFreeScheme(urlObj);
        }
    } catch {
        logger.warn('[DeepLink] Invalid URL:', url);
    }
}

async function handleMusicFreeScheme(url: URL): Promise<void> {
    if (url.hostname === 'install') {
        await handleInstall(url);
    }
}

async function handleInstall(url: URL): Promise<void> {
    try {
        const raw = url.pathname.slice(1) || url.searchParams.get('plugin');
        if (!raw) {
            logger.warn('[DeepLink] install: missing plugin URL');
            return;
        }

        const pluginUrls = raw.split(',').map(decodeURIComponent).filter(Boolean);

        const results = await Promise.allSettled(
            pluginUrls.map((pluginUrl) => pluginManager.installPlugin(pluginUrl)),
        );

        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === 'fulfilled' && r.value.success) {
                logger.info('[DeepLink] Installed plugin:', pluginUrls[i]);
            } else {
                const reason = r.status === 'rejected' ? r.reason : r.value.message;
                logger.warn('[DeepLink] Failed to install plugin:', pluginUrls[i], reason);
            }
        }
    } catch (e) {
        logger.error('[DeepLink] install error:', e);
    }
}
