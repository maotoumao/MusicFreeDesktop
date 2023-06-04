import SvgAsset from "@/renderer/components/SvgAsset";
import "./index.scss";
import { useLocation, useNavigate } from "react-router-dom";

export default function HeaderNavigator() {
  const loc = useLocation();
  const navigate = useNavigate();
  const canBack = history.state.idx > 0;
  const canGo = history.state.idx < history.length - 1;

  return (
    <div className="header-navigator">
      <div
        className="navigator-btn"
        data-disabled={!canBack}
        title={canBack ? "后退" : undefined}
        role="button"
        onClick={() => {
          navigate(-1);
        }}
      >
        <SvgAsset iconName="chevron-left"></SvgAsset>
      </div>
      <div
        className="navigator-btn"
        data-disabled={!canGo}
        title={canGo ? "前进" : undefined}
        onClick={() => {
          navigate(1);
        }}
      >
        <SvgAsset iconName="chevron-right"></SvgAsset>
      </div>
    </div>
  );
}
