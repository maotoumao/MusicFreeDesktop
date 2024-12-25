import {useState} from "react";
import SvgAsset from "@/renderer/components/SvgAsset";
import {PlayerState} from "@/common/constant";
import albumImg from "@/assets/imgs/album-cover.jpg";

import "./index.scss";
import {useTranslation} from "react-i18next";
import {useUserPreference} from "@/renderer/utils/user-perference";
import {appWindowUtil} from "@shared/utils/renderer";
import messageBus, {useAppStatePartial} from "@shared/message-bus/renderer/extension";


export default function MinimodePage() {
    const [hover, setHover] = useState(false);
    const currentMusicItem = useAppStatePartial("musicItem");
    const playerState = useAppStatePartial("playerState");
    const lyricItem = useAppStatePartial("parsedLrc");

    const {t} = useTranslation();
    const [showTranslation] = useUserPreference("showTranslation");

    const textContent = (
        <div className="text-container">
      <span>
        {lyricItem?.lrc || currentMusicItem?.title || t("media.unknown_title")}
      </span>
            {showTranslation ? <span>{lyricItem?.translation}</span> : null}
        </div>
    );

    const options = (
        <div className="options-container">
            <div
                role="button"
                className="close-button"
                onClick={() => {
                    appWindowUtil.setMinimodeWindow(false);
                    appWindowUtil.showMainWindow();
                }}
            >
                <SvgAsset iconName="x-mark"></SvgAsset>
            </div>
            <div
                role="button"
                className="option-item"
                onClick={() => {
                    messageBus.sendCommand("SkipToPrevious");
                }}
            >
                <SvgAsset iconName="skip-left"></SvgAsset>
            </div>
            <div
                role="button"
                className="option-item"
                onClick={() => {
                    messageBus.sendCommand(
                        "TogglePlayerState"
                    );
                }}
            >
                <SvgAsset
                    iconName={playerState === PlayerState.Playing ? "pause" : "play"}
                ></SvgAsset>
            </div>

            <div
                role="button"
                className="option-item"
                onClick={() => {
                    messageBus.sendCommand("SkipToNext");
                }}
            >
                <SvgAsset iconName="skip-right"></SvgAsset>
            </div>
        </div>
    );

    return (
        <div className="minimode-page-container">
            <div
                className="minimode-header-container"
                onMouseEnter={() => {
                    setHover(true);
                }}
                onMouseLeave={() => {
                    setHover(false);
                }}
            >
                <div className="mini-mode-header-background-mask"></div>
                <div
                    className="mini-mode-header-background"
                    style={{
                        backgroundImage: `url(${currentMusicItem?.artwork || albumImg})`,
                    }}
                ></div>
                <img
                    title={
                        (currentMusicItem?.title || t("media.unknown_title")) +
                        " - " +
                        (currentMusicItem?.artist || t("media.unknown_artist"))
                    }
                    draggable="false"
                    className="album-container"
                    src={currentMusicItem?.artwork || albumImg}
                    onDoubleClick={() => {
                        appWindowUtil.showMainWindow();
                    }}
                ></img>
                <div className="body-container">{hover ? options : textContent}</div>
            </div>
        </div>
    );
}
