import { ReactNode, useEffect, useRef } from "react";
import { hideModal } from "../..";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";

interface IBaseModalProps {
  // 默认区域
  onDefaultClick?: () => void;
  // 点击默认区域时关闭
  defaultClose?: boolean;
  // 模糊
  withBlur?: boolean;
  children: ReactNode;
}

const baseId = "components--modal-base-container";

function Base(props: IBaseModalProps) {
  const {
    onDefaultClick,
    defaultClose = false,
    children,
    withBlur = true,
  } = props;

  const trapCloseRef = useRef(false);

  return (
    <div
      id={baseId}
      className={`components--modal-base animate__animated animate__fadeIn ${
        withBlur ? "blur10" : ""
      }`}
      role="button"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement)?.id === baseId) {
          trapCloseRef.current = true;
        } else {
          trapCloseRef.current = false;
        }
      }}
      onMouseUp={(e) => {
        if ((e.target as HTMLElement)?.id === baseId && trapCloseRef.current) {
          if (defaultClose) {
            hideModal();
          } else {
            onDefaultClick?.();
          }
        }
      }}
      onMouseLeave={() => {
        trapCloseRef.current = false;
      }}
      onMouseOut={() => {
        trapCloseRef.current = false;
      }}
    >
      {children}
    </div>
  );
}

interface IHeaderProps {
  children: ReactNode;
}
function Header(props: IHeaderProps) {
  const { children } = props;

  return (
    <div className="components--modal-base-header">
      {children}
      <div
        role="button"
        className="components--modal-base-header-close opacity-button"
        onClick={() => {
          hideModal();
        }}
      >
        <SvgAsset iconName="x-mark"></SvgAsset>
      </div>
    </div>
  );
}

Base.Header = Header;
export default Base;
