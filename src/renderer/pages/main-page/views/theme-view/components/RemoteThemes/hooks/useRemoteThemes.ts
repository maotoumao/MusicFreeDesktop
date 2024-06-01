import { RequestStateCode, themePackStoreBaseUrl } from "@/common/constant";
import useMounted from "@/renderer/hooks/useMounted";
import Themepack from "@/shared/themepack/renderer";
import axios from "axios";
import { useEffect, useState } from "react";

let themeStoreConfig: IThemeStoreItem[] = [
  {
    publishName: "birds-of-a-feather-3f72ef18cc9a29f805e1dc8f6260d64d",
    packageName: "birds-of-a-feather",
    config: {
      name: "飞鸟",
      preview:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/birds-of-a-feather/imgs/preview.png",
      author: "猫头猫",
      iframe: { app: "@/iframes/app.html" },
      srcUrl:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/.publish/birds-of-a-feather-3f72ef18cc9a29f805e1dc8f6260d64d.mftheme",
    },
  },
  {
    publishName: "darkmode-32c031e1c795f39cbdb53b9674efd12a",
    packageName: "darkmode",
    config: {
      name: "暗黑模式",
      preview: "#000",
      author: "猫头猫",
      description: "暗黑模式，好黑啊。",
      srcUrl:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/.publish/darkmode-32c031e1c795f39cbdb53b9674efd12a.mftheme",
    },
  },
  {
    publishName: "fliqlo-4c902e5cc42a4ffeeae240c79df768e9",
    packageName: "fliqlo",
    config: {
      name: "fliqlo",
      preview:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/fliqlo/imgs/preview.png",
      description: "类似fliqlo的效果",
      author: "猫头猫",
      iframe: { app: "@/iframes/app.html" },
      srcUrl:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/.publish/fliqlo-4c902e5cc42a4ffeeae240c79df768e9.mftheme",
    },
  },
  {
    publishName: "night-star-08c37b62da7647b0f5ce542ffa8579ae",
    packageName: "night-star",
    config: {
      name: "星夜",
      preview:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/night-star/assets/night_sky_stars_linear_gradient_hd_8k_anime_style_8013dbdf-270b-4f00-b981-5745e056aae3.png",
      description: "背景图片",
      author: "猫头猫",
      srcUrl:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/.publish/night-star-08c37b62da7647b0f5ce542ffa8579ae.mftheme",
    },
  },
  {
    publishName: "rainy-season-28907caafdae22596cc6f221b02b4778",
    packageName: "rainy-season",
    config: {
      name: "雨季",
      preview:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/rainy-season/imgs/preview.png",
      iframe: { app: "@/iframes/app.html" },
      author: "猫头猫",
      srcUrl:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/.publish/rainy-season-28907caafdae22596cc6f221b02b4778.mftheme",
    },
  },
  {
    publishName: "sakura-34687ebc448460b868445b8677e0f2c1",
    packageName: "sakura",
    config: {
      name: "樱花",
      preview:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/sakura/imgs/preview.png",
      iframe: { app: "@/iframes/app.html" },
      author: "猫头猫",
      srcUrl:
        "https://gitee.com/maotoumao/MusicFreeThemePacks/raw/master/.publish/sakura-34687ebc448460b868445b8677e0f2c1.mftheme",
    },
  },
] as any;

interface IThemeStoreItem {
  publishName: string;
  packageName: string;
  config: ICommon.IThemePack;
}

export default function () {
  const [themes, setThemes] = useState(themeStoreConfig || []);
  const [loadingState, setLoadingState] = useState(
    RequestStateCode.PENDING_FIRST_PAGE
  );
  const isMounted = useMounted();

  useEffect(() => {
    if (themeStoreConfig) {
      setThemes(themeStoreConfig);
      setLoadingState(RequestStateCode.FINISHED);
    } else {
      Promise.race(
        themePackStoreBaseUrl.map(
          async (it, index) =>
            [await axios.get(it + ".publish/publish.json"), index] as const
        )
      )
        .then(([res, index]) => {
          const data: IThemeStoreItem[] = res.data;
          const pickedUrl = themePackStoreBaseUrl[index];

          data.forEach((theme) => {
            theme.config.srcUrl = `${pickedUrl}.publish/${theme.publishName}.mftheme`;
            if (theme.config.preview) {
              theme.config.preview = Themepack.replaceAlias(
                theme.config.preview,
                pickedUrl + theme.packageName + "/",
                false
              );
            }
            if (theme.config.thumb) {
              theme.config.thumb = Themepack.replaceAlias(
                theme.config.thumb,
                pickedUrl + theme.packageName + "/",
                false
              );
            }
          });
          themeStoreConfig = data;

          if (isMounted.current) {
            setLoadingState(RequestStateCode.FINISHED);
            setThemes(data);
          }
        })
        .catch((e) => {
          setLoadingState(RequestStateCode.ERROR);
        });
    }
  }, []);

  return [themes, loadingState] as const;
}
