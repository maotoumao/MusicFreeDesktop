import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X } from 'lucide-react';
import { cn } from '@common/cn';
import appConfig from '@infra/appConfig/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import './index.scss';

interface WindowControlsProps {
    className?: string;
}

/**
 * WindowControls — 无边框主窗口的最小化 / 最大化 / 关闭按钮
 *
 * 顶栏与全屏播放页共用；关闭按钮按「关闭按钮行为」设置退出或收起到托盘。
 */
export function WindowControls({ className }: WindowControlsProps) {
    const { t } = useTranslation();

    const handleMinimize = useCallback(() => {
        systemUtil.minimizeWindow();
    }, []);

    const handleMaximize = useCallback(() => {
        systemUtil.toggleMaximize();
    }, []);

    const handleClose = useCallback(() => {
        if (appConfig.getConfigByKey('normal.closeBehavior') === 'exit_app') {
            systemUtil.exitApp();
        } else {
            systemUtil.minimizeWindow(true);
        }
    }, []);

    return (
        <div className={cn('l-window-controls', className)}>
            <button
                className="l-window-controls__btn"
                type="button"
                title={t('app.minimize')}
                onClick={handleMinimize}
            >
                <Minus size={14} strokeWidth={1.5} />
            </button>
            <button
                className="l-window-controls__btn"
                type="button"
                title={t('app.maximize')}
                onClick={handleMaximize}
            >
                <Square size={10} strokeWidth={1.5} />
            </button>
            <button
                className="l-window-controls__btn l-window-controls__btn--close"
                type="button"
                title={t('common.close')}
                onClick={handleClose}
            >
                <X size={14} strokeWidth={1.5} />
            </button>
        </div>
    );
}
