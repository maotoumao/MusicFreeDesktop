import { ReactNode } from "react";
import { closeModal } from "../..";
import "./index.scss";

interface IBaseModalProps {
  // 默认区域
  onDefaultClick?: () => void;
  // 模糊
  withBlur?: boolean;
  children: ReactNode;
}

const baseId = "components--modal-base-container";

export default function Base(props: IBaseModalProps) {
  const { onDefaultClick = closeModal, children, withBlur = true } = props;

  return (
    <div
      id={baseId}
      className={`components--modal-base animate__animated animate__fadeIn ${withBlur ? 'blur10' : ''}`}
      role="button"
      onClick={(e) => {
        if ((e.target as HTMLElement)?.id === baseId) {
          onDefaultClick?.();
        }
      }}
    >
      {children}
    </div>
  );
}
