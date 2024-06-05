import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnResizeMode,
  ColumnDef,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";

import "./index.scss";
import Tag from "../Tag";
import { secondsToDuration } from "@/common/time-util";
import MusicSheet from "@/renderer/core/music-sheet";
import trackPlayer from "@/renderer/core/track-player";
import Condition, { IfTruthy } from "../Condition";
import Empty from "../Empty";
import MusicFavorite from "../MusicFavorite";
import MusicDownloaded from "../MusicDownloaded";
import { RequestStateCode, localPluginName } from "@/common/constant";
import BottomLoadingState from "../BottomLoadingState";
import { IContextMenuItem, showContextMenu } from "../ContextMenu";
import {
  getInternalData,
  getMediaPrimaryKey,
  isSameMedia,
} from "@/common/media-util";
import {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { showModal } from "../Modal";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import { isBetween } from "@/common/normalize-util";
import { ipcRendererInvoke, ipcRendererSend } from "@/shared/ipc/renderer";
import hotkeys from "hotkeys-js";
import Downloader from "@/renderer/core/downloader";
import { toast } from "react-toastify";
import SwitchCase from "../SwitchCase";
import SvgAsset from "../SvgAsset";
import musicSheetDB from "@/renderer/core/db/music-sheet-db";
import DragReceiver, { startDrag } from "../DragReceiver";
import { i18n } from "@/shared/i18n/renderer";
import { getAppConfigPath } from "@/shared/app-config/renderer";

interface IMusicListProps {
  /** 展示的播放列表 */
  musicList: IMusic.IMusicItem[];
  /** 实际的播放列表 */
  getAllMusicItems?: () => IMusic.IMusicItem[];
  /** 音乐列表所属的歌单信息 */
  musicSheet?: IMusic.IMusicSheetItem;
  // enablePagination?: boolean; // 分页/虚拟长列表
  state?: RequestStateCode; // 网络状态
  doubleClickBehavior?: "replace" | "normal"; // 双击行为
  onPageChange?: (page?: number) => void; // 分页
  /** 虚拟滚动参数 */
  virtualProps?: {
    offsetHeight?: number | (() => number); // 距离顶部的高度
    getScrollElement?: () => HTMLElement; // 滚动
    fallbackRenderCount?: number;
  };
  containerStyle?: CSSProperties;
  hideRows?: Array<
    "like" | "index" | "title" | "artist" | "album" | "duration" | "platform"
  >;
  /** 允许拖拽 */
  enableDrag?: boolean;
  /** 拖拽结束 */
  onDragEnd?: (newMusicList: IMusic.IMusicItem[]) => void;
}

const columnHelper = createColumnHelper<IMusic.IMusicItem>();
const columnDef: ColumnDef<IMusic.IMusicItem>[] = [
  columnHelper.display({
    id: "like",
    size: 42,
    minSize: 42,
    maxSize: 42,
    cell: (info) => (
      <div className="music-list-operations">
        <MusicFavorite musicItem={info.row.original} size={18}></MusicFavorite>
        <MusicDownloaded musicItem={info.row.original}></MusicDownloaded>
      </div>
    ),
    enableResizing: false,
    enableSorting: false,
  }),
  columnHelper.accessor((_, index) => index + 1, {
    cell: (info) => info.getValue(),
    header: "#",
    id: "index",
    minSize: 40,
    maxSize: 40,
    size: 40,
    enableResizing: false,
  }),
  columnHelper.accessor("title", {
    header: () => i18n.t("media.media_title"),
    size: 250,
    maxSize: 300,
    minSize: 100,
    cell: (info) => {
      const title = info?.getValue?.();
      return <span title={title}>{title}</span>;
    },
    // @ts-ignore
    fr: 3,
  }),

  columnHelper.accessor("artist", {
    header: () => i18n.t("media.media_type_artist"),
    size: 130,
    maxSize: 200,
    minSize: 60,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
    // @ts-ignore
    fr: 2,
  }),
  columnHelper.accessor("album", {
    header: () => i18n.t("media.media_type_album"),
    size: 120,
    maxSize: 200,
    minSize: 60,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
    // @ts-ignore
    fr: 2,
  }),
  columnHelper.accessor("duration", {
    header: () => i18n.t("media.media_duration"),
    size: 64,
    maxSize: 150,
    minSize: 48,
    cell: (info) =>
      info.getValue() ? secondsToDuration(info.getValue()) : "--:--",
    // @ts-ignore
    fr: 1,
  }),
  columnHelper.accessor("platform", {
    header: () => i18n.t("media.media_platform"),
    size: 100,
    minSize: 80,
    maxSize: 300,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
    // @ts-ignore
    fr: 1,
  }),
];

const estimizeItemHeight = 2.6 * 13; // lineheight 2.6rem

export function showMusicContextMenu(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  x: number,
  y: number,
  sheetType?: string
) {
  const menuItems: IContextMenuItem[] = [];
  const isArray = Array.isArray(musicItems);
  if (!isArray) {
    menuItems.push(
      {
        title: `ID: ${getMediaPrimaryKey(musicItems)}`,
        icon: "identification",
      },
      {
        title: `${i18n.t("media.media_type_artist")}: ${
          musicItems.artist ?? i18n.t("media.unknown_artist")
        }`,
        icon: "user",
      },
      {
        title: `${i18n.t("media.media_type_album")}: ${
          musicItems.album ?? i18n.t("media.unknown_album")
        }`,
        icon: "album",
        show: !!musicItems.album,
      },
      {
        divider: true,
      }
    );
  }
  menuItems.push(
    {
      title: i18n.t("music_list_context_menu.next_play"),
      icon: "motion-play",
      onClick() {
        trackPlayer.addNext(musicItems);
      },
    },
    {
      title: i18n.t("music_list_context_menu.add_to_my_sheets"),
      icon: "document-plus",
      onClick() {
        showModal("AddMusicToSheet", {
          musicItems: musicItems,
        });
      },
    },
    {
      title: i18n.t("music_list_context_menu.remove_from_sheet"),
      icon: "trash",
      show: !!sheetType && sheetType !== "play-list",
      onClick() {
        MusicSheet.frontend.removeMusicFromSheet(musicItems, sheetType);
      },
    },
    {
      title: i18n.t("common.remove"),
      icon: "trash",
      show: sheetType === "play-list",
      onClick() {
        trackPlayer.removeFromQueue(musicItems);
      },
    }
  );

  menuItems.push(
    {
      title: i18n.t("common.download"),
      icon: "array-download-tray",
      show: isArray
        ? !musicItems.every(
            (item) =>
              item.platform === localPluginName || Downloader.isDownloaded(item)
          )
        : musicItems.platform !== localPluginName &&
          !Downloader.isDownloaded(musicItems),
      onClick() {
        Downloader.startDownload(musicItems);
      },
    },
    {
      title: i18n.t("music_list_context_menu.delete_local_download"),
      icon: "trash",
      show:
        (isArray && musicItems.every((it) => Downloader.isDownloaded(it))) ||
        (!isArray && Downloader.isDownloaded(musicItems)),
      async onClick() {
        const [isSuccess, info] = await Downloader.removeDownloadedMusic(
          musicItems,
          true
        );
        if (isSuccess) {
          if (isArray) {
            toast.success(
              i18n.t(
                "music_list_context_menu.delete_local_downloaded_songs_success",
                {
                  musicNums: musicItems.length,
                }
              )
            );
          } else {
            toast.success(
              i18n.t(
                "music_list_context_menu.delete_local_downloaded_song_success",
                {
                  songName: (musicItems as IMusic.IMusicItem).title,
                }
              )
            );
          }
        } else if (info?.msg) {
          toast.error(info.msg);
        }
      },
    },
    {
      title: i18n.t(
        "music_list_context_menu.reveal_local_music_in_file_explorer"
      ),
      icon: "folder-open",
      show:
        !isArray &&
        (Downloader.isDownloaded(musicItems) ||
          musicItems?.platform === localPluginName),
      async onClick() {
        try {
          if (!isArray) {
            let realTimeMusicItem = musicItems;
            if (musicItems.platform !== localPluginName) {
              realTimeMusicItem = await musicSheetDB.musicStore.get([
                musicItems.platform,
                musicItems.id,
              ]);
            }
            const result = await ipcRendererInvoke(
              "show-item-in-folder",
              getInternalData<IMusic.IMusicItemInternalData>(
                realTimeMusicItem,
                "downloadData"
              )?.path
            );
            if (!result) {
              throw new Error();
            }
          }
        } catch (e) {
          toast.error(
            `${i18n.t(
              "music_list_context_menu.reveal_local_music_in_file_explorer_fail"
            )} ${e?.message ?? ""}`
          );
        }
      },
    }
  );

  showContextMenu({
    x,
    y,
    menuItems,
  });
}

function _MusicList(props: IMusicListProps) {
  const {
    musicList,
    state = RequestStateCode.FINISHED,
    onPageChange,
    musicSheet,
    virtualProps,
    // getAllMusicItems,
    doubleClickBehavior,
    containerStyle,
    hideRows,
    enableDrag,
    onDragEnd,
  } = props;

  const [sorting, setSorting] = useState<SortingState>([]);

  const musicListRef = useRef(musicList);
  const columnShownRef = useRef(
    getAppConfigPath("normal.musicListColumnsShown").reduce(
      (prev, curr) => ({
        ...prev,
        [curr]: false,
      }),
      {}
    )
  );

  const table = useReactTable({
    debugAll: false,
    data: musicList,
    columns: columnDef,
    state: {
      sorting: sorting,
      columnVisibility: hideRows
        ? hideRows.reduce((prev, curr) => ({ ...prev, [curr]: false }), {
            ...columnShownRef.current,
          })
        : columnShownRef.current,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableContainerRef = useRef<HTMLDivElement>();
  const virtualController = useVirtualList({
    data: table.getRowModel().rows,
    getScrollElement: virtualProps?.getScrollElement,
    offsetHeight: virtualProps?.offsetHeight,
    estimizeItemHeight,
    fallbackRenderCount: !(
      virtualProps?.getScrollElement || virtualProps?.offsetHeight
    )
      ? -1
      : virtualProps?.fallbackRenderCount ?? 100,
  });

  const [activeItems, setActiveItems] = useState<number[]>([]);

  useEffect(() => {
    setActiveItems([]);
    musicListRef.current = musicList;
  }, [musicList]);

  useEffect(() => {
    const ctrlAHandler = (evt: Event) => {
      evt.preventDefault();
      setActiveItems([0, musicListRef.current.length - 1]);
    };
    hotkeys("Ctrl+A", "music-list", ctrlAHandler);

    return () => {
      hotkeys.unbind("Ctrl+A", ctrlAHandler);
    };
  }, []);

  const _onDrop = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!onDragEnd || fromIndex === toIndex) {
        // 没有移动
        return;
      }
      const newData = musicList
        .slice(0, fromIndex)
        .concat(musicList.slice(fromIndex + 1));
      newData.splice(
        fromIndex > toIndex ? toIndex : toIndex - 1,
        0,
        musicList[fromIndex]
      );
      onDragEnd?.(newData);
    },
    [onDragEnd, musicList]
  );

  return (
    <div
      className="music-list-container"
      style={containerStyle}
      ref={tableContainerRef}
      tabIndex={-1}
      onFocus={() => {
        hotkeys.setScope("music-list");
      }}
      onBlur={() => {
        hotkeys.setScope("all");
      }}
    >
      <table
        style={{
          height: virtualController.totalHeight + estimizeItemHeight,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <th
                key={header.id}
                data-id={header.id}
                style={{
                  //@ts-ignore
                  width: header.column.columnDef.fr
                    ? //@ts-ignore
                      `${header.column.columnDef.fr * 100}%`
                    : header.column.columnDef.size,
                }}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
                <div
                  className="sort-container"
                  data-sorting={header.column.getIsSorted() !== false}
                >
                  <SwitchCase.Switch switch={header.column.getIsSorted()}>
                    <SwitchCase.Case case={"asc"}>
                      <SvgAsset iconName="sort-asc"></SvgAsset>
                    </SwitchCase.Case>
                    <SwitchCase.Case case={"desc"}>
                      <SvgAsset iconName="sort-desc"></SvgAsset>
                    </SwitchCase.Case>
                    <SwitchCase.Case case={false}>
                      <SvgAsset iconName="sort"></SvgAsset>
                    </SwitchCase.Case>
                  </SwitchCase.Switch>
                </div>
                {/* <div
                  onMouseDown={header.getResizeHandler()}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={classNames({
                    resizer: true,
                    "resizer-resizing": header.column.getIsResizing(),
                  })}
                ></div> */}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          style={{
            transform: `translateY(${virtualController.startTop}px)`,
          }}
        >
          {virtualController.virtualItems.map((virtualItem, index) => {
            const row = virtualItem.dataItem;

            if (!row.original) {
              return null;
            }
            // todo 拆出一个组件
            return (
              <tr
                key={row.id}
                data-active={
                  activeItems.length === 2
                    ? isBetween(
                        virtualItem.rowIndex,
                        activeItems[0],
                        activeItems[1]
                      )
                    : activeItems[0] === virtualItem.rowIndex
                }
                onContextMenu={(e) => {
                  if (
                    activeItems.length === 2 &&
                    isBetween(
                      virtualItem.rowIndex,
                      activeItems[0],
                      activeItems[1]
                    ) &&
                    activeItems[0] !== activeItems[1]
                  ) {
                    let [start, end] = activeItems;
                    if (start > end) {
                      [start, end] = [end, start];
                    }

                    showMusicContextMenu(
                      table
                        .getRowModel()
                        .rows.slice(start, end + 1)
                        .map((item) => item.original),
                      e.clientX,
                      e.clientY,
                      musicSheet?.platform === localPluginName
                        ? musicSheet.id
                        : undefined
                    );
                  } else {
                    setActiveItems([virtualItem.rowIndex]);
                    showMusicContextMenu(
                      row.original,
                      e.clientX,
                      e.clientY,
                      musicSheet?.platform === localPluginName
                        ? musicSheet.id
                        : undefined
                    );
                  }
                }}
                onClick={() => {
                  // 如果点击的时候按下shift
                  if (hotkeys.shift) {
                    setActiveItems([activeItems[0] ?? 0, virtualItem.rowIndex]);
                  } else {
                    setActiveItems([virtualItem.rowIndex]);
                  }
                }}
                onDoubleClick={() => {
                  const config =
                    doubleClickBehavior ??
                    getAppConfigPath("playMusic.clickMusicList");
                  if (config === "replace") {
                    trackPlayer.playMusicWithReplaceQueue(
                      table.getRowModel().rows.map((it) => it.original),
                      row.original
                    );
                  } else {
                    trackPlayer.playMusic(row.original);
                  }
                }}
                draggable={enableDrag}
                onDragStart={(e) => {
                  // TODO
                  // if(activeItems) {

                  // }
                  startDrag(e, virtualItem.rowIndex, "musiclist");
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      //@ts-ignore
                      width: cell.column.columnDef.fr
                        ? //@ts-ignore
                          `${cell.column.columnDef.fr * 100}%`
                        : cell.column.columnDef.size,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <IfTruthy condition={enableDrag}>
                  <IfTruthy condition={index === 0}>
                    <DragReceiver
                      position="top"
                      rowIndex={virtualItem.rowIndex}
                      onDrop={_onDrop}
                      tag="musiclist"
                      insideTable
                    ></DragReceiver>
                  </IfTruthy>
                  <DragReceiver
                    position="bottom"
                    rowIndex={virtualItem.rowIndex + 1}
                    onDrop={_onDrop}
                    tag="musiclist"
                    insideTable
                  ></DragReceiver>
                </IfTruthy>
              </tr>
            );
          })}
        </tbody>
        <tfoot
          style={{
            height:
              virtualController.totalHeight -
              virtualController.virtualItems.length * estimizeItemHeight,
          }}
        ></tfoot>
      </table>
      <Condition
        condition={musicList.length === 0}
        falsy={
          <BottomLoadingState
            state={state}
            onLoadMore={onPageChange}
          ></BottomLoadingState>
        }
      >
        <Empty></Empty>
      </Condition>
    </div>
  );
}

export default memo(
  _MusicList,
  (prev, curr) =>
    prev.state === curr.state &&
    prev.enableDrag === curr.enableDrag &&
    prev.musicList === curr.musicList &&
    prev.onPageChange === curr.onPageChange &&
    prev.onDragEnd === curr.onDragEnd &&
    prev.musicSheet &&
    curr.musicSheet &&
    isSameMedia(prev.musicSheet, curr.musicSheet)
);
