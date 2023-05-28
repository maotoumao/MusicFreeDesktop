import "./index.scss";

interface IProps {
  // 默认区域
  onDefaultClick?: () => void;
  // 模糊
  withBlur?: boolean;
  children: JSX.Element | JSX.Element[];
}

const baseId = "components--modal-base-container";

export default function Base(props: IProps) {
  const { onDefaultClick, children, withBlur = true } = props;

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
