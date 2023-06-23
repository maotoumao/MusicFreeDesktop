import "./index.scss";

interface ILoadingProps {
  text?: string
}
export default function Loading(props: ILoadingProps) {
  return (
    <div className="loading-container">
      <div className="spinner-container">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span>{props.text ?? '加载中'}</span>
    </div>
  );
}
