import { callPluginDelegateMethod } from "@/renderer/core/plugin-delegate";
import { useEffect, useState } from "react";

export default function useTopListDetail(
  topListItem: IMusic.IMusicSheetItem | null,
  platform: string
) {
  const [mergedTopListItem, setMergedTopListItem] =
    useState<ICommon.WithMusicList<IMusic.IMusicSheetItem> | null>(topListItem);

  useEffect(() => {
    if (topListItem === null) {
      return;
    }
    console.log("here", topListItem, platform);
    callPluginDelegateMethod(
      {
        platform,
      },
      "getTopListDetail",
      topListItem
    )
      .then((_) => {
        console.log("hh", _);
        if (_) {
          setMergedTopListItem(
            (prev) =>
              ({
                ...(prev ?? {}),
                ...(_ ?? {}),
              } as any)
          );
        }
      })
      .catch((e) => {
        console.log("catch", e);
        setMergedTopListItem((prev) => ({
          ...prev,
          musicList: [],
        }));
      });
  }, []);
  return mergedTopListItem;
}
