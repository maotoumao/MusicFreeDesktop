import { RequestStateCode } from "@/common/constant";
import { callPluginDelegateMethod } from "@/renderer/core/plugin-delegate";
import { useCallback, useEffect, useRef, useState } from "react";

export default function usePluginSheetMusicList(
  originalSheetItem: IMusic.IMusicSheetItem | null
) {
  const currentPageRef = useRef(1);
  const [requestState, setRequestState] = useState<RequestStateCode>(
    RequestStateCode.IDLE
  );
  const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
    originalSheetItem
  );
  const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>(
    originalSheetItem?.musicList ?? []
  );

  const getSheetDetail = useCallback(
    async function () {
      if (
        originalSheetItem === null ||
        requestState & RequestStateCode.PENDING_FIRST_PAGE
      ) {
        return;
      }

      try {
        setRequestState(
          currentPageRef.current === 1
            ? RequestStateCode.PENDING_FIRST_PAGE
            : RequestStateCode.PENDING_REST_PAGE
        );
        const result = await callPluginDelegateMethod(
          originalSheetItem,
          "getMusicSheetInfo",
          originalSheetItem,
          currentPageRef.current
        );

        if (result === null || result === undefined) {
          throw new Error();
        }
        if (result?.sheetItem) {
          setSheetItem((prev) => ({
            ...(prev ?? {}),
            ...(result.sheetItem as IMusic.IMusicSheetItem),
            platform: originalSheetItem.platform,
          }));
        }
        if (result?.musicList) {
          setMusicList((prev) => {
            if (currentPageRef.current === 1) {
              return result?.musicList ?? prev;
            } else {
              return [...prev, ...(result.musicList ?? [])];
            }
          });
        }
        setRequestState(
          result.isEnd
            ? RequestStateCode.FINISHED
            : RequestStateCode.PARTLY_DONE
        );
        currentPageRef.current += 1;
      } catch {
        setRequestState(currentPageRef.current === 1 ? RequestStateCode.FINISHED: RequestStateCode.PARTLY_DONE);
      }
    },
    [requestState]
  );

  useEffect(() => {
    getSheetDetail();
  }, []);

  return [requestState, sheetItem, musicList, getSheetDetail] as const;
}
