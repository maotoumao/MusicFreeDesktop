import { RequestStateCode, themePackStoreBaseUrl } from "@/common/constant";
import useMounted from "@/renderer/hooks/useMounted";
import Themepack from "@/shared/themepack/renderer";
import axios from "axios";
import { useEffect, useState } from "react";

let themeStoreConfig: IThemeStoreItem[];

interface IThemeStoreItem {
  publishName: string;
  hash: string;
  packageName: string;
  config: ICommon.IThemePack;
}

function raceWithData<T>(promises: Array<Promise<T>>): Promise<T> {
  const promiseCount = promises.length;
  return new Promise((resolve, reject) => {
    let isResolved = false;
    let rejectedNum = 0;
    promises.forEach((promise) => {
      promise
        .then((data) => {
          if (!isResolved) {
            isResolved = true;
            resolve(data);
          }
        })
        .catch((e) => {
          ++rejectedNum;
          if (rejectedNum === promiseCount) {
            reject(e);
          }
        });
    });
  });
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
      raceWithData(
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
