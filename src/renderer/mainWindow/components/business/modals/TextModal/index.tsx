import Modal from '@renderer/mainWindow/components/ui/Modal';
import './index.scss';

interface TextModalProps {
    close: () => void;
    /** 弹窗标题 */
    title: string;
    /** 展示的文本内容 */
    content: string;
}

/**
 * TextModal — 纯文本展示弹窗（业务组件）
 *
 * 用于展示较长的纯文本内容（如歌单简介等），
 * 仅有关闭按钮，无 footer 操作区。
 */
export default function TextModal({ close, title, content }: TextModalProps) {
    return (
        <Modal open onClose={close} title={title} size="md">
            <p className="text-modal__content">{content}</p>
        </Modal>
    );
}
