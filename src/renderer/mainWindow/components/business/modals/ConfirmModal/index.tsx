import { useState, useCallback } from 'react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { useTranslation } from 'react-i18next';
import './index.scss';

export interface ConfirmModalProps {
    close: () => void;
    /** 弹窗标题 */
    title: string;
    /** 主要提示文本 */
    message: string;
    /** 次要说明文本（可选） */
    description?: string;
    /** 确认按钮文本 */
    confirmText?: string;
    /** 取消按钮文本 */
    cancelText?: string;
    /** 确认回调（支持 async） */
    onConfirm: () => void | Promise<void>;
    /** 确认按钮是否为危险样式（红色色调） */
    confirmDanger?: boolean;
}

/**
 * ConfirmModal — 通用确认弹窗（业务组件）
 *
 * 可复用于卸载、删除等需要确认的操作。
 * 通过 confirmDanger 切换确认按钮为红色色调。
 */
export default function ConfirmModal({
    close,
    title,
    message,
    description,
    confirmText,
    cancelText,
    onConfirm,
    confirmDanger = false,
}: ConfirmModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const handleConfirm = useCallback(async () => {
        setLoading(true);
        try {
            await onConfirm();
            close();
        } catch {
            // onConfirm 内部应自行处理错误提示
        } finally {
            setLoading(false);
        }
    }, [onConfirm, close]);

    return (
        <Modal
            open
            onClose={close}
            title={title}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={loading}>
                        {cancelText ?? t('common.cancel')}
                    </Button>
                    <Button
                        variant={confirmDanger ? 'secondary' : 'primary'}
                        danger={confirmDanger}
                        onClick={handleConfirm}
                        loading={loading}
                    >
                        {confirmText ?? t('common.confirm')}
                    </Button>
                </>
            }
        >
            <p className="confirm-modal__message">{message}</p>
            {description && <p className="confirm-modal__description">{description}</p>}
        </Modal>
    );
}
