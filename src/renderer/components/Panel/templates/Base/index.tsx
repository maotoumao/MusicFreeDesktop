import { ReactNode, useEffect, useRef } from "react";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import { hidePanel } from "../..";

interface IBaseModalProps {
  // 默认区域
  onDefaultClick?: () => void;
  // 点击默认区域时关闭
  defaultClose?: boolean;
  // 模糊
  withBlur?: boolean;
  /** mask区域颜色 */
  maskColor?: string;
  /** 标题 */
  title?: ReactNode;
  width?: string | number;
  scrollable?: boolean;
  children: ReactNode;
}

const baseId = "components--panel-base-container";

function Base(props: IBaseModalProps) {
  const {
    onDefaultClick,
    defaultClose = true,
    maskColor,
    children,
    withBlur = false,
    width,
    scrollable = true,
  } = props;

  const trapCloseRef = useRef(false);

  return (
    <div
      id={baseId}
      className={`components--panel-base animate__animated animate__fadeIn ${
        withBlur ? "blur10" : ""
      }`}
      style={{
        backgroundColor: maskColor,
      }}
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
            hidePanel();
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
      <div
        className="components--panel-base-content animate__animated animate__slideInRight shadow"
        style={{
          width: width,
          overflowY: scrollable ? "auto" : "initial",
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface IHeaderProps {
  children: ReactNode;
  right?: ReactNode;
}
function Header(props: IHeaderProps) {
  const { children, right } = props;

  return (
    <div className="components--panel-base-header">
      {children}
      {right ?? (
        <div
          role="button"
          className="components--panel-base-header-close opacity-button"
          onClick={() => {
            hidePanel();
          }}
        >
          <SvgAsset iconName="x-mark"></SvgAsset>
        </div>
      )}
    </div>
  );
}

Base.Header = Header;
export default Base;
