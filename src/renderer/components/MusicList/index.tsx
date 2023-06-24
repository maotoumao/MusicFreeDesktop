import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import "./index.scss";
import Tag from "../Tag";
import { secondsToDuration } from "@/common/time-util";
import MusicSheet from "@/renderer/core/music-sheet";
import trackPlayer from "@/renderer/core/track-player";
import Condition from "../Condition";
import Empty from "../Empty";
import MusicFavorite from "../MusicFavorite";
import { RequestStateCode, localPluginName } from "@/common/constant";
import BottomLoadingState from "../BottomLoadingState";
import { showContextMenu } from "../ContextMenu";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import { memo, useRef } from "react";
import { showModal } from "../Modal";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import rendererAppConfig from "@/common/app-config/renderer";

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
  };
}

const columnHelper = createColumnHelper<IMusic.IMusicItem>();
const columnDef = [
  columnHelper.display({
    id: "like",
    size: 32,
    cell: (info) => (
      <MusicFavorite musicItem={info.row.original} size={18}></MusicFavorite>
    ),
  }),
  columnHelper.accessor((_, index) => index + 1, {
    cell: (info) => info.getValue(),
    header: () => "#",
    id: "index",
    minSize: 40,
    maxSize: 40,
    size: 40,
  }),
  columnHelper.accessor("title", {
    header: "标题",
    size: 250,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),

  columnHelper.accessor("artist", {
    header: "作者",
    size: 130,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("album", {
    header: "专辑",
    size: 120,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("duration", {
    header: "时长",
    size: 64,
    cell: (info) =>
      info.getValue() ? secondsToDuration(info.getValue()) : "--:--",
  }),
  columnHelper.accessor("platform", {
    header: "来源",
    size: 100,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
  }),
];

const estimizeItemHeight = 2.6 * 13;

export function showMusicContextMenu(
  musicItem: IMusic.IMusicItem,
  x: number,
  y: number,
  localMusicSheetId?: string
) {
  showContextMenu({
    x,
    y,
    menuItems: [
      {
        title: `ID: ${getMediaPrimaryKey(musicItem)}`,
        icon: "identification",
      },
      {
        title: `作者: ${musicItem.artist}`,
        icon: "user",
      },
      {
        title: `专辑: ${musicItem.album}`,
        icon: "album",
        show: !!musicItem.album,
      },
      {
        divider: true,
      },
      {
        title: "下一首播放",
        icon: "motion-play",
        onClick() {
          trackPlayer.addNext(musicItem);
        },
      },
      {
        title: "添加到歌单",
        icon: "document-plus",
        onClick() {
          showModal("AddMusicToSheet", {
            musicItems: musicItem,
          });
        },
      },
      {
        title: "从歌单内删除",
        icon: "trash",
        show: !!localMusicSheetId,
        onClick() {
          MusicSheet.removeMusicFromSheet(musicItem, localMusicSheetId);
        },
      },
    ],
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
  } = props;

  const table = useReactTable({
    debugAll: false,
    data: musicList,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableContainerRef = useRef<HTMLDivElement>();
  const virtualController = useVirtualList({
    data: table.getRowModel().rows,
    getScrollElement: virtualProps?.getScrollElement,
    offsetHeight: virtualProps?.offsetHeight,
    estimizeItemHeight,
    fallbackRenderCount: 100,
  });

  return (
    <div className="music-list-container" ref={tableContainerRef}>
      <table
        style={{
          height: virtualController.totalHeight + estimizeItemHeight,
        }}
      >
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <th
                key={header.id}
                style={{
                  width: header.id === "extra" ? undefined : header.getSize(),
                }}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
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
            return (
              <tr
                key={row.id}
                onContextMenu={(e) => {
                  showMusicContextMenu(
                    row.original,
                    e.clientX,
                    e.clientY,
                    musicSheet?.platform === localPluginName
                      ? musicSheet.id
                      : undefined
                  );
                }}
                onDoubleClick={() => {
                  const config =
                    doubleClickBehavior ??
                    rendererAppConfig.getAppConfigPath(
                      "playMusic.clickMusicList"
                    );
                  if (config === "replace") {
                    trackPlayer.playMusicWithReplaceQueue(
                      getAllMusicItems?.() ?? musicList,
                      row.original
                    );
                  } else {
                    trackPlayer.playMusic(row.original);
                  }
                }}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
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
