import { RequestStateCode } from "@/common/constant";
import { callPluginDelegateMethod } from "@/renderer/core/plugin-delegate";
import { useCallback, useEffect, useRef, useState } from "react";

const idleCode = [
  RequestStateCode.IDLE,
  RequestStateCode.FINISHED,
  RequestStateCode.PARTLY_DONE,
];

export default function useAlbumDetail(
  originalAlbumItem: IAlbum.IAlbumItem | null
) {
  const currentPageRef = useRef(1);
  const [requestState, setRequestState] = useState<RequestStateCode>(
    RequestStateCode.IDLE
  );
  const [albumItem, setAlbumItem] = useState<IAlbum.IAlbumItem | null>(
    originalAlbumItem
  );
  const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>(
    originalAlbumItem?.musicList ?? []
  );

  const getAlbumDetail = useCallback(
    async function () {
      if (originalAlbumItem === null || !idleCode.includes(requestState)) {
        return;
      }

      try {
        setRequestState(
          currentPageRef.current === 1
            ? RequestStateCode.PENDING_FIRST_PAGE
            : RequestStateCode.PENDING_REST_PAGE
        );
        const result = await callPluginDelegateMethod(
          originalAlbumItem,
          "getAlbumInfo",
          originalAlbumItem,
          currentPageRef.current
        );

        if (result === null || result === undefined) {
          throw new Error();
        }
        if (result?.albumItem) {
          setAlbumItem((prev) => ({
            ...(prev ?? {}),
            ...(result.albumItem as IAlbum.IAlbumItem),
            platform: originalAlbumItem.platform,
          }));
        }
        if (result?.musicList) {
          const currentPage = currentPageRef.current;
          setMusicList((prev) => {
            if (currentPage === 1) {
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
      } catch (e) {
        setRequestState(RequestStateCode.IDLE);
      }
    },
    [requestState]
  );

  useEffect(() => {
    getAlbumDetail();
  }, []);
  console.log(musicList);

  return [requestState, albumItem, musicList, getAlbumDetail] as const;
}
