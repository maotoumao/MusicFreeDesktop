import { ipcRendererSend } from "@/common/ipc-util/renderer";
import SvgAsset from "../SvgAsset";
import "./index.scss";
import { showModal } from "../Modal";
import { useLocation, useNavigate } from "react-router-dom";
import { useRef } from "react";
import HeaderNavigator from "./widgets/Navigator";


export default function AppHeader() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>();
 
  function onSearchSubmit() {
    navigate(`/main/search/${inputRef.current.value}`);
  }


  return (
    <div className="header-container">
      <div className="left-part">
        <div className="logo">
          <SvgAsset iconName="logo"></SvgAsset>
        </div>
       <HeaderNavigator></HeaderNavigator>
        <div className="search">
          <input
            ref={inputRef}
            className="search-input"
            placeholder="在这里输入搜索内容"
            maxLength={50}
            onKeyDown={(key) => {
              if (key.key === "Enter") {
                onSearchSubmit();
              }
            }}
          ></input>
          <div className="search-submit" role="button" onClick={onSearchSubmit}>
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
            ipcRendererSend("min-window", {});
          }}
        >
          <SvgAsset iconName="minus"></SvgAsset>
        </div>
        <div
          role="button"
          title="退出"
          className="header-button"
          onClick={() => {
            showModal("ExitConfirm");
            console.log("close");
          }}
        >
          <SvgAsset iconName="x-mark"></SvgAsset>
        </div>
      </div>
    </div>
  );
}
