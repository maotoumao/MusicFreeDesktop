import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import systemUtil from '@infra/systemUtil/renderer';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import './index.scss';

interface PluginDescriptionModalProps {
    close: () => void;
    plugin: IPlugin.IPluginDelegate;
}

// 局部 marked 实例，避免污染全局单例
const localMarked = new Marked();
const renderer = new localMarked.Renderer();
renderer.link = ({ href, text }) => `<a href="${href}" rel="noopener noreferrer">${text}</a>`;

localMarked.setOptions({
    renderer,
    breaks: true,
    gfm: true,
});

/**
 * PluginDescriptionModal — 插件说明弹窗
 *
 * 使用 marked 解析 Markdown，DOMPurify 消毒 HTML，防止 XSS。
 */
export default function PluginDescriptionModal({ close, plugin }: PluginDescriptionModalProps) {
    const { t } = useTranslation();

    const descriptionHtml = useMemo(() => {
        if (!plugin.description) return '';
        const rawHtml = localMarked.parse(plugin.description) as string;
        return DOMPurify.sanitize(rawHtml);
    }, [plugin.description]);

    /** 事件委托：拦截 markdown 内所有 <a> 点击，用系统浏览器打开 */
    const handleMarkdownClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const anchor = (e.target as HTMLElement).closest('a');
        if (!anchor) return;
        e.preventDefault();
        const href = anchor.getAttribute('href');
        if (href) {
            systemUtil.openExternal(href);
        }
    }, []);

    return (
        <Modal
            open
            onClose={close}
            title={`${t('plugin.plugin_description')} · ${plugin.platform}`}
            size="lg"
            footer={
                <Button variant="secondary" onClick={close}>
                    {t('common.confirm')}
                </Button>
            }
        >
            {plugin.description ? (
                <div
                    className="plugin-modal__markdown"
                    onClick={handleMarkdownClick}
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
            ) : (
                <p className="plugin-modal__muted-text">{t('plugin.no_description')}</p>
            )}
        </Modal>
    );
}
