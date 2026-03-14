/**
 * 启动后副作用
 *
 * 在主窗口 bootstrap 完成后执行的非阻塞后台任务：
 *   1. 自动更新插件（读取 plugin.autoUpdatePlugin 配置）
 *   2. 检查软件更新（读取 normal.checkUpdate 配置）
 *
 * 所有任务 fire-and-forget，不阻塞 UI。
 */
import { compare } from 'compare-versions';
import appConfig from '@infra/appConfig/renderer';
import pluginManager from '@infra/pluginManager/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import { syncKV } from '@renderer/common/kvStore';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import { checkLegacyMigration } from '@renderer/mainWindow/core/legacyMigration';

export function runPostBootstrapTasks(): void {
    autoUpdatePlugins();
    checkAppUpdate();
    checkLegacyMigration();
}

/** 自动更新插件 */
function autoUpdatePlugins(): void {
    if (!appConfig.getConfigByKey('plugin.autoUpdatePlugin')) return;

    pluginManager.updateAllPlugins().catch((err) => {
        console.error('[PostBootstrap] Auto-update plugins failed:', err);
    });
}

/** 检查软件更新 */
function checkAppUpdate(): void {
    if (__DEV__) return;
    if (!(appConfig.getConfigByKey('normal.checkUpdate') ?? true)) return;

    systemUtil
        .checkUpdate()
        .then((info) => {
            if (!info.update) return;

            const skipVersion = syncKV.get('update.skipVersion');
            if (skipVersion && compare(info.update.version, skipVersion, '<=')) {
                return;
            }

            showModal('UpdateModal', { updateInfo: info.update });
        })
        .catch((err) => {
            console.error('[PostBootstrap] Check app update failed:', err);
        });
}
