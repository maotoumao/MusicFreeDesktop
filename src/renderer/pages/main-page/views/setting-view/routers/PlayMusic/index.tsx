import { IAppConfig } from "@/shared/app-config/type";
import "./index.scss";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import { useOutputAudioDevices } from "@/renderer/hooks/useMediaDevices";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import trackPlayer from "@/renderer/core/track-player";
import { setAppConfigPath } from "@/shared/app-config/renderer";
import { useTranslation } from "react-i18next";

interface IProps {
  data: IAppConfig["playMusic"];
}

export default function PlayMusic(props: IProps) {
  const { data = {} as IAppConfig["playMusic"] } = props;

  const audioDevices = useOutputAudioDevices();
  const { t } = useTranslation();

  return (
    <div className="setting-view--play-music-container">
      <CheckBoxSettingItem
        keyPath="playMusic.caseSensitiveInSearch"
        checked={data.caseSensitiveInSearch}
        label={t("settings.play_music.case_sensitive_in_search")}
      ></CheckBoxSettingItem>
      <RadioGroupSettingItem
        label={t("settings.play_music.default_play_quality")}
        keyPath="playMusic.defaultQuality"
        value={data?.defaultQuality}
        options={[
          {
            value: "low",
            title: t("media.music_quality_low"),
          },
          {
            value: "standard",
            title: t("media.music_quality_standard"),
          },
          {
            value: "high",
            title: t("media.music_quality_high"),
          },
          {
            value: "super",
            title: t("media.music_quality_super"),
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label={t("settings.play_music.when_quality_missing")}
        keyPath="playMusic.whenQualityMissing"
        value={data.whenQualityMissing}
        options={[
          {
            value: "lower",
            title: t("settings.play_music.play_lower_quality_version"),
          },
          {
            value: "higher",
            title: t("settings.play_music.play_higher_quality_version"),
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label={t("settings.play_music.when_play_error")}
        keyPath="playMusic.playError"
        value={data.playError}
        options={[
          {
            value: "pause",
            title: t("settings.play_music.pause"),
          },
          {
            value: "skip",
            title: t("settings.play_music.skip_to_next"),
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label={t("settings.play_music.double_click_music_list")}
        keyPath="playMusic.clickMusicList"
        value={data.clickMusicList}
        options={[
          {
            value: "normal",
            title: t("settings.play_music.add_music_to_playlist"),
          },
          {
            value: "replace",
            title: t("settings.play_music.replace_playlist_with_musiclist"),
          },
        ]}
      ></RadioGroupSettingItem>
      <ListBoxSettingItem
        label={t("settings.play_music.audio_output_device")}
        keyPath="playMusic.audioOutputDevice"
        value={data.audioOutputDevice}
        renderItem={(item) => {
          return item ? item.label : t("common.default");
        }}
        width={"320px"}
        onChange={async (item) => {
          const result = await trackPlayer.setAudioOutputDevice(item.deviceId);
          if (result) {
            setAppConfigPath("playMusic.audioOutputDevice", item.toJSON());
          }
        }}
        options={audioDevices}
      ></ListBoxSettingItem>
      <RadioGroupSettingItem
        label={t("settings.play_music.when_device_removed")}
        keyPath="playMusic.whenDeviceRemoved"
        value={data.whenDeviceRemoved}
        options={[
          {
            value: "pause",
            title: t("settings.play_music.pause"),
          },
          {
            value: "play",
            title: t("settings.play_music.continue_playing"),
          },
        ]}
      ></RadioGroupSettingItem>
    </div>
  );
}
