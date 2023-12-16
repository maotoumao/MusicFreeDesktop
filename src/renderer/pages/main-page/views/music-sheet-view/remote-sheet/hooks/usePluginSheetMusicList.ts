import { RequestStateCode } from "@/common/constant";
import { isSameMedia } from "@/common/media-util";
import { callPluginDelegateMethod } from "@/renderer/core/plugin-delegate";
import { useEffect, useRef, useState } from "react";

export default function usePluginSheetMusicList(
  platform: string,
  id: string,
  originalSheetItem?: IMusic.IMusicSheetItem | null // 额外的输入
) {
  const [requestState, setRequestState] = useState<RequestStateCode>(
    RequestStateCode.IDLE
  );
  const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>({
    ...originalSheetItem,
    platform,
    id,
  });
  const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>(
    originalSheetItem?.musicList ?? []
  );

  // 当前正在搜索的信息
  const currentSheetItemRef = useRef<IMusic.IMusicSheetItem | null>(null);
  // 页码
  const currentPageRef = useRef(1);

  const getSheetDetail = async () => {
    if (!isSameMedia(currentSheetItemRef.current, originalSheetItem)) {
      // 1.1 如果是切换了新的歌单
      // 恢复初始状态 并设置当前的歌曲项
      currentSheetItemRef.current = {
        ...originalSheetItem,
        platform,
        id,
      };
      setSheetItem(currentSheetItemRef.current);
      setMusicList(originalSheetItem?.musicList ?? []);
      currentPageRef.current = 1;
    } else if (requestState & RequestStateCode.PENDING_FIRST_PAGE) {
      // 1.2 如果是原有歌单，并且在loading中，返回
      return;
    }

    try {
      // 2. 设置初始状态
      setRequestState(
        currentPageRef.current === 1
          ? RequestStateCode.PENDING_FIRST_PAGE
          : RequestStateCode.PENDING_REST_PAGE
      );
      // 3. 调用获取音乐详情接口
      const sheetItem = currentSheetItemRef.current;
      const result = await callPluginDelegateMethod(
        sheetItem,
        "getMusicSheetInfo",
        sheetItem,
        currentPageRef.current
      );

      if (!isSameMedia(currentSheetItemRef.current, sheetItem)) {
        // 出现竞态 结果直接舍弃
        return;
      }
      if (result === null || result === undefined) {
        throw new Error();
      }
      // 3. 如果在页码为1的时候返回了sheetItem，重新设置下sheetItem
      if (result?.sheetItem && currentPageRef.current <= 1) {
        setSheetItem((prev) => ({
          ...(prev ?? {}),
          ...(result.sheetItem as IMusic.IMusicSheetItem),
          platform: originalSheetItem.platform,
        }));
      }
      // 4. 如果返回了音乐列表
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
        result.isEnd ? RequestStateCode.FINISHED : RequestStateCode.PARTLY_DONE
      );
      currentPageRef.current += 1;
    } catch {
      setRequestState(
        currentPageRef.current === 1
          ? RequestStateCode.FINISHED
          : RequestStateCode.PARTLY_DONE
      );
    }
  };

  useEffect(() => {
    if (platform && id) {
      getSheetDetail();
    }
  }, [platform, id]);

  return [requestState, sheetItem, musicList, getSheetDetail] as const;
}
