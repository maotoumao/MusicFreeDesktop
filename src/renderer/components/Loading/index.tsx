import "./index.scss";

export default function Loading() {
  return (
    <div className="loading-container">
      <div className="spinner-container">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span>加载中</span>
    </div>
  );
}
