import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';

interface ExampleModalProps {
    close: () => void;
    title?: string;
    content?: string;
}

/**
 * ExampleModal — 示例业务弹窗
 *
 * 用于演示 showModal 命令式调用。
 * close 由 ModalContainer 自动注入。
 */
export default function ExampleModal({ close, title, content }: ExampleModalProps) {
    return (
        <Modal
            open
            onClose={close}
            title={title ?? '示例弹窗'}
            subtitle="这是一个通过 showModal 命令式打开的弹窗"
            size="sm"
            footer={
                <>
                    <Button variant="ghost" size="sm" onClick={close}>
                        取消
                    </Button>
                    <Button variant="primary" size="sm" onClick={close}>
                        确认
                    </Button>
                </>
            }
        >
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {content ?? '弹窗内容区域。关闭后如果栈中还有其他弹窗，会自动展示下一个。'}
            </p>
        </Modal>
    );
}
