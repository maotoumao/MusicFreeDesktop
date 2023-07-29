import { ipcRendererSend } from "@/common/ipc-util/renderer";
import SvgAsset from "../SvgAsset";
import "./index.scss";
import { showModal } from "../Modal";
import { useLocation, useNavigate } from "react-router-dom";
import { useRef } from "react";
import HeaderNavigator from "./widgets/Navigator";
import Evt from "@/renderer/core/events";
import rendererAppConfig from "@/common/app-config/renderer";
import { musicDetailShownStore } from "../MusicDetail";

export default function AppHeader() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>();

  function onSearchSubmit() {
    if(inputRef.current.value) {
      navigate(`/main/search/${inputRef.current.value}`);
      musicDetailShownStore.setValue(false);
    }
  }

  return (
    <div className="header-container">
      <div className="left-part">
        <div className="logo">
          <SvgAsset iconName="logo"></SvgAsset>
        </div>
        <HeaderNavigator></HeaderNavigator>
        <div className="header-search">
          <input
            ref={inputRef}
            className="header-search-input"
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
        <div
          role="button"
          className="header-button sparkles-icon"
          onClick={() => {
            showModal("Sparkles");
          }}
        >
          <SvgAsset iconName="sparkles"></SvgAsset>
        </div>
        <div className="header-divider"></div>
        <div
          role="button"
          className="header-button"
          title="设置"
          onClick={() => {
            navigate("/main/setting");
            Evt.emit("HIDE_MUSIC_DETAIL");
          }}
        >
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
            const exitBehavior = rendererAppConfig.getAppConfigPath('normal.closeBehavior');
            if(exitBehavior === 'minimize') {
              ipcRendererSend('min-window', {
                skipTaskBar: true
              })
            } else {
              ipcRendererSend('exit-app');
            }
          }}
        >
          <SvgAsset iconName="x-mark"></SvgAsset>
        </div>
      </div>
    </div>
  );
}
