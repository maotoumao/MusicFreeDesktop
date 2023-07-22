import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";
import { ReactNode } from "react";

interface IReconfirmProps {
  title: string;
  content: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function Reconfirm(props: IReconfirmProps) {
  const { title, content, onConfirm, onCancel } = props;

  return (
    <Base withBlur={false}>
      <div className="modal--reconfirm shadow backdrop-color">
        <Base.Header>{title}</Base.Header>
        <div className="content-container">{content}</div>
        <div className="opeartion-area">
          <div role="button" data-type="normalButton" onClick={() => {
            onCancel?.();
            hideModal();
          }}>
            取消
          </div>
          <div role="button" data-type="dangerButton" data-fill={true} onClick={onConfirm}>
            确认
          </div>
        </div>
      </div>
    </Base>
  );
}
