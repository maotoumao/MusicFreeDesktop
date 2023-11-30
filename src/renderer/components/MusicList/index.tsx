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
import Condition from "../Condition";
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
import { CSSProperties, memo, useEffect, useRef, useState } from "react";
import { showModal } from "../Modal";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import rendererAppConfig from "@/common/app-config/renderer";
import { isBetween } from "@/common/normalize-util";
import { ipcRendererSend } from "@/common/ipc-util/renderer";
import hotkeys from "hotkeys-js";
import Downloader from "@/renderer/core/downloader";
import { toast } from "react-toastify";
import classNames from "@/renderer/utils/classnames";
import SwitchCase from "../SwitchCase";
import SvgAsset from "../SvgAsset";
import { getAppConfigPath } from "@/common/app-config/main";

interface IMusicListProps {
  /** 展示的播放列表 */
  musicList: IMusic.IMusicItem[];
  /** 实际的播放列表 */
  getAllMusicItems?: () => IMusic.IMusicItem[];
  /** 音乐列表所属的歌单信息 */
  musicSheet?: IMusic.IMusicSheetItem;
  // enablePagination?: boolean; // 分页/虚拟长列表
  enableSort?: boolean; // 拖拽排序
  onSortEnd?: () => void; // 排序结束
  state?: RequestStateCode;
  doubleClickBehavior?: "replace" | "normal";
  onPageChange?: (page?: number) => void;
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
    header: () => "#",
    id: "index",
    minSize: 40,
    maxSize: 40,
    size: 40,
    enableResizing: false,
  }),
  columnHelper.accessor("title", {
    header: "标题",
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
    header: "作者",
    size: 130,
    maxSize: 200,
    minSize: 60,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
    // @ts-ignore
    fr: 2,
  }),
  columnHelper.accessor("album", {
    header: "专辑",
    size: 120,
    maxSize: 200,
    minSize: 60,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
    // @ts-ignore
    fr: 2,
  }),
  columnHelper.accessor("duration", {
    header: "时长",
    size: 64,
    maxSize: 150,
    minSize: 48,
    cell: (info) =>
      info.getValue() ? secondsToDuration(info.getValue()) : "--:--",
    // @ts-ignore
    fr: 1,
  }),
  columnHelper.accessor("platform", {
    header: "来源",
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
  localMusicSheetId?: string
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
        title: `作者: ${musicItems.artist}`,
        icon: "user",
      },
      {
        title: `专辑: ${musicItems.album}`,
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
      title: "下一首播放",
      icon: "motion-play",
      onClick() {
        trackPlayer.addNext(musicItems);
      },
    },
    {
      title: "添加到歌单",
      icon: "document-plus",
      onClick() {
        showModal("AddMusicToSheet", {
          musicItems: musicItems,
        });
      },
    },
    {
      title: "从歌单内删除",
      icon: "trash",
      show: !!localMusicSheetId,
      onClick() {
        MusicSheet.removeMusicFromSheet(musicItems, localMusicSheetId);
      },
    }
  );

  menuItems.push(
    {
      title: "下载",
      icon: "array-download-tray",
      show: isArray
        ? !musicItems.every(
            (item) =>
              item.platform === localPluginName || Downloader.isDownloaded(item)
          )
        : musicItems.platform !== localPluginName &&
          !Downloader.isDownloaded(musicItems),
      onClick() {
        Downloader.generateDownloadMusicTask(musicItems);
      },
    },
    {
      title: "删除本地下载",
      icon: "trash",
      show:
        (isArray && musicItems.every((it) => Downloader.isDownloaded(it))) ||
        (!isArray && Downloader.isDownloaded(musicItems)),
      async onClick() {
        try {
          await Downloader.removeDownloadedMusic(musicItems, true);
          if (isArray) {
            toast.success(`已删除 ${musicItems.length} 首本地歌曲`);
          } else {
            toast.success(
              `已删除本地歌曲 [${(musicItems as IMusic.IMusicItem).title}]`
            );
          }
        } catch (e) {
          toast.error(`删除失败: ${e?.message ?? ""}`);
        }
      },
    },
    {
      title: "打开歌曲所在文件夹",
      icon: "folder-open",
      show:
        !isArray &&
        (Downloader.isDownloaded(musicItems) ||
          musicItems?.platform === localPluginName),
      async onClick() {
        try {
          if (!isArray) {
            const filePath = getInternalData<IMusic.IMusicItemInternalData>(
                  musicItems,
                  "downloadData"
                )?.path
            const downloadBasePath =
        rendererAppConfig.getAppConfigPath("download.path") ??
        window.globalData.appPath.downloads;        
            ipcRendererSend(
              "open-path",
              filePath ? window.path.dirname(filePath) : downloadBasePath
            );
          }
        } catch (e) {
          toast.error(`打开歌曲所在文件夹失败: ${e?.message ?? ""}`);
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
    getAllMusicItems,
    doubleClickBehavior,
    containerStyle,
    hideRows,
  } = props;

  const [sorting, setSorting] = useState<SortingState>([]);

  const musicListRef = useRef(musicList);
  const columnShownRef = useRef(
    rendererAppConfig.getAppConfigPath("normal.musicListColumnsShown").reduce(
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
        ? hideRows.reduce((prev, curr) => ({ ...prev, [curr]: false }), {...columnShownRef.current})
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
    const musiclistScope = "ml" + Math.random().toString().slice(2);
    hotkeys("Shift", musiclistScope, () => {});
    const ctrlAHandler = (evt: Event) => {
      evt.preventDefault();
      setActiveItems([0, musicListRef.current.length - 1]);
    };
    hotkeys("Ctrl+A", ctrlAHandler);

    return () => {
      hotkeys.unbind("Shift", musiclistScope);
      hotkeys.unbind("Ctrl+A", ctrlAHandler);
    };
  }, []);

  return (
    <div
      className="music-list-container"
      style={containerStyle}
      ref={tableContainerRef}
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
          {virtualController.virtualItems.map((virtualItem) => {
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
                    rendererAppConfig.getAppConfigPath(
                      "playMusic.clickMusicList"
                    );
                  if (config === "replace") {
                    // TODO: 排序后的
                    trackPlayer.playMusicWithReplaceQueue(
                      getAllMusicItems?.() ?? musicList,
                      row.original
                    );
                  } else {
                    trackPlayer.playMusic(row.original);
                  }
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
    prev.enableSort === curr.enableSort &&
    prev.musicList === curr.musicList &&
    prev.onPageChange === curr.onPageChange &&
    prev.onSortEnd === curr.onSortEnd &&
    prev.musicSheet &&
    curr.musicSheet &&
    isSameMedia(prev.musicSheet, curr.musicSheet)
);
