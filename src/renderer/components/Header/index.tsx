import SvgAsset from "../SvgAsset";
import "./index.scss";

export default function Header() {
  return (
    <div className="header-container">
      <div className="left-part">
        <div className="logo">
          <SvgAsset iconName="logo"></SvgAsset>
        </div>
        <div className="navigator">
          <div className="navigator-btn">
            <SvgAsset iconName="chevron-left"></SvgAsset>
          </div>
          <div className="navigator-btn">
            <SvgAsset iconName="chevron-right"></SvgAsset>
          </div>
        </div>
        <div className="search">
          <input
            className="search-input"
            placeholder="在这里输入搜索内容"
          ></input>
          <div className="search-submit" role="button">
            <SvgAsset iconName="magnifying-glass"></SvgAsset>
          </div>
        </div>
      </div>

      <div className="right-part">
        <div role="button" className="header-button" title="设置">
          <SvgAsset iconName="cog-8-tooth"></SvgAsset>
        </div>
        <div
          role="button"
          title="最小化"
          className="header-button"
          onClick={() => {
            console.log("MinusSvg");
          }}
        >
          <SvgAsset iconName="minus"></SvgAsset>
        </div>
        <div
          role="button"
          title="退出"
          className="header-button"
          onClick={() => {
            console.log("close");
          }}
        >
          <SvgAsset iconName="x-mark"></SvgAsset>
        </div>
      </div>
    </div>
  );
}
