import { useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Rss, Link2, Pencil, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@common/cn';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import pluginManager from '@infra/pluginManager/renderer';
import appConfig from '@infra/appConfig/renderer';
import './index.scss';

interface SubscriptionItem {
    name: string;
    srcUrl: string;
}

/** 带唯一 id 的订阅项（仅组件内部使用） */
interface SubscriptionItemWithId extends SubscriptionItem {
    _id: number;
}

interface PluginSubscriptionModalProps {
    close: () => void;
}

/** framer-motion 列表行动画 */
const rowVariants = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0, transition: { duration: 0.15 } },
};

const rowTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

/**
 * PluginSubscriptionModal — 订阅管理弹窗
 *
 * 设计要点：
 *   - 顶部常驻快速添加栏 (Quick Add Bar)，提升添加效率
 *   - 独立的卡片式列表，增加呼吸感与层级感
 *   - 卡片悬浮态展示操作按钮，保持界面整洁
 *   - 编辑态：卡片内嵌表单，带品牌色高亮
 *   - 自动保存：添加、修改、删除操作立即生效
 */
export default function PluginSubscriptionModal({ close }: PluginSubscriptionModalProps) {
    const { t } = useTranslation();

    const nextIdRef = useRef(0);
    const initial = useMemo(() => {
        const raw = appConfig.getConfigByKey('private.pluginSubscription') ?? [];
        return raw.map((s) => ({ ...s, _id: nextIdRef.current++ }));
    }, []);

    const [subscriptions, setSubscriptions] = useState<SubscriptionItemWithId[]>(initial);
    const [updating, setUpdating] = useState(false);

    // 快速添加状态
    const [quickAddUrl, setQuickAddUrl] = useState('');

    // 编辑状态：数字为正在编辑的项的 ID，null 为未编辑
    const [editingId, setEditingId] = useState<number | null>(null);

    // 编辑表单的临时状态
    const [editForm, setEditForm] = useState<SubscriptionItem>({ name: '', srcUrl: '' });

    // 保存到配置
    const saveToConfig = useCallback((newList: SubscriptionItemWithId[]) => {
        const valid = newList
            .filter((s) => s.srcUrl.trim())
            .map(({ name, srcUrl }) => ({ name, srcUrl }));
        appConfig.setConfig({ 'private.pluginSubscription': valid });
    }, []);

    // 快速添加
    const handleQuickAdd = useCallback(() => {
        const trimmedUrl = quickAddUrl.trim();
        if (!trimmedUrl) return;

        const newList = [
            { name: '', srcUrl: trimmedUrl, _id: nextIdRef.current++ },
            ...subscriptions,
        ];
        setSubscriptions(newList);
        saveToConfig(newList);
        setQuickAddUrl('');
    }, [quickAddUrl, subscriptions, saveToConfig]);

    // 开始编辑
    const handleStartEdit = useCallback((sub: SubscriptionItemWithId) => {
        setEditForm({ name: sub.name, srcUrl: sub.srcUrl });
        setEditingId(sub._id);
    }, []);

    // 取消编辑
    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    // 保存编辑
    const handleSaveEdit = useCallback(() => {
        const trimmedUrl = editForm.srcUrl.trim();
        if (!trimmedUrl) {
            showToast(t('plugin.subscription_url') + ' ' + t('common.required'), {
                type: 'warn',
            });
            return;
        }

        const newList = subscriptions.map((s) =>
            s._id === editingId ? { ...s, ...editForm, srcUrl: trimmedUrl } : s,
        );

        setSubscriptions(newList);
        saveToConfig(newList);
        setEditingId(null);
    }, [editForm, editingId, subscriptions, saveToConfig, t]);

    // 删除
    const handleRemove = useCallback(
        (id: number) => {
            const newList = subscriptions.filter((s) => s._id !== id);
            setSubscriptions(newList);
            saveToConfig(newList);
            if (editingId === id) {
                setEditingId(null);
            }
        },
        [subscriptions, editingId, saveToConfig],
    );

    // 全部更新
    const handleUpdateAll = useCallback(async () => {
        const valid = subscriptions.filter((s) => s.srcUrl.trim());
        if (!valid.length) {
            showToast(t('plugin.no_subscription'), { type: 'warn' });
            return;
        }

        setUpdating(true);
        let successCount = 0;
        let failCount = 0;
        for (const sub of valid) {
            try {
                await pluginManager.installPlugin(sub.srcUrl.trim());
                successCount++;
            } catch {
                failCount++;
            }
        }
        if (failCount === 0) {
            showToast(t('plugin.update_successfully'));
        } else {
            showToast(
                t('plugin.subscription_update_summary', {
                    success: successCount,
                    fail: failCount,
                }),
                { type: failCount > 0 && successCount === 0 ? 'warn' : undefined },
            );
        }
        setUpdating(false);
    }, [subscriptions, t]);

    return (
        <Modal
            open
            onClose={close}
            title={t('plugin.subscription_setting')}
            subtitle={t('plugin.subscription_subtitle')}
            size="md"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={handleUpdateAll}
                        loading={updating}
                        icon={<Rss size={14} />}
                    >
                        {t('plugin.update_all_subscriptions')}
                    </Button>
                    <Button variant="primary" onClick={close} disabled={updating}>
                        {t('common.close')}
                    </Button>
                </>
            }
        >
            <div className="plugin-modal__subscriptions">
                {/* 快速添加栏 */}
                <div className="plugin-modal__quick-add">
                    <Input
                        className="plugin-modal__quick-add-input"
                        prefix={<Link2 size={16} />}
                        placeholder={t('plugin.subscription_url')}
                        value={quickAddUrl}
                        onChange={(e) => setQuickAddUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickAdd();
                        }}
                    />
                    <Button
                        variant="primary"
                        icon={<Plus size={16} />}
                        disabled={!quickAddUrl.trim()}
                        onClick={handleQuickAdd}
                    >
                        {t('plugin.add_subscription')}
                    </Button>
                </div>

                {/* 订阅列表 */}
                <div className="plugin-modal__sub-list">
                    {subscriptions.length === 0 ? (
                        <div className="plugin-modal__sub-empty">
                            <div className="plugin-modal__sub-empty-icon">
                                <Rss size={24} />
                            </div>
                            <span className="plugin-modal__sub-empty-title">
                                {t('plugin.no_subscription')}
                            </span>
                            <span className="plugin-modal__sub-empty-hint">
                                {t('plugin.subscription_empty')}
                            </span>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {subscriptions.map((sub) => (
                                <motion.div
                                    key={sub._id}
                                    layout
                                    variants={rowVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={rowTransition}
                                    className={cn(
                                        'plugin-modal__sub-card',
                                        editingId === sub._id && 'is-editing',
                                    )}
                                >
                                    {editingId === sub._id ? (
                                        /* 编辑态 */
                                        <>
                                            <div className="plugin-modal__sub-card-edit-inputs">
                                                <Input
                                                    placeholder={t('plugin.subscription_name')}
                                                    value={editForm.name}
                                                    onChange={(e) =>
                                                        setEditForm((prev) => ({
                                                            ...prev,
                                                            name: e.target.value,
                                                        }))
                                                    }
                                                />
                                                <Input
                                                    prefix={<Link2 size={14} />}
                                                    placeholder={t('plugin.subscription_url')}
                                                    value={editForm.srcUrl}
                                                    onChange={(e) =>
                                                        setEditForm((prev) => ({
                                                            ...prev,
                                                            srcUrl: e.target.value,
                                                        }))
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit();
                                                    }}
                                                />
                                            </div>
                                            <div className="plugin-modal__sub-card-edit-footer">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={<X size={14} />}
                                                    onClick={handleCancelEdit}
                                                >
                                                    {t('common.cancel')}
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    icon={<Check size={14} />}
                                                    onClick={handleSaveEdit}
                                                    disabled={!editForm.srcUrl.trim()}
                                                >
                                                    {t('common.save')}
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        /* 展示态 */
                                        <>
                                            <div className="plugin-modal__sub-card-icon">
                                                <Rss size={16} />
                                            </div>
                                            <div className="plugin-modal__sub-card-content">
                                                <span className="plugin-modal__sub-card-name">
                                                    {sub.name || sub.srcUrl || ''}
                                                </span>
                                                {sub.name && (
                                                    <span className="plugin-modal__sub-card-url">
                                                        {sub.srcUrl}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="plugin-modal__sub-card-actions">
                                                <button
                                                    type="button"
                                                    className="plugin-modal__sub-card-btn"
                                                    onClick={() => handleStartEdit(sub)}
                                                    aria-label={t('common.edit')}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="plugin-modal__sub-card-btn plugin-modal__sub-card-btn--danger"
                                                    onClick={() => handleRemove(sub._id)}
                                                    aria-label={t('plugin.delete_subscription')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </Modal>
    );
}
