import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import "./index.scss";
import SvgAsset from "../SvgAsset";
import Tag from "../Tag";
import { secondsToDuration } from "@/common/time-util";
import MusicSheet from "@/renderer/core/music-sheet";
import trackPlayer from "@/renderer/core/track-player";
import Condition from "../Condition";
import Empty from "../Empty";
import MusicFavorite from "../MusicFavorite";
import { RequestStateCode, localPluginName } from "@/common/constant";
import SwitchCase from "../SwitchCase";
import BottomLoadingState from "../BottomLoadingState";
import { showContextMenu } from "../ContextMenu";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import { memo, useRef } from "react";
import { showModal } from "../Modal";

interface IMusicListProps {
  musicList: IMusic.IMusicItem[];
  /** 音乐列表所属的歌单信息 */
  musicSheet?: IMusic.IMusicSheetItem;
  // enablePagination?: boolean; // 分页/虚拟长列表
  enableSort?: boolean; // 拖拽排序
  onSortEnd?: () => void; // 排序结束
  state?: RequestStateCode;
  isEnd?: boolean;
  onPageChange?: (page?: number) => void;
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

function showMusicContextMenu(
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
        show: !!musicItem.album,
      },
      {
        divider: true,
      },
      {
        title: "下一首播放",
        onClick() {
          trackPlayer.addNext(musicItem);
        },
      },
      {
        title: "添加到歌单",
        onClick() {
          showModal("AddMusicToSheet", {
            musicItems: musicItem,
          });
        },
      },
      {
        title: "从歌单内删除",
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
  } = props;

  const table = useReactTable({
    debugAll: false,
    data: musicList,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableContainerRef = useRef<HTMLDivElement>();



  return (
    <div className="music-list-container" ref={tableContainerRef}>
      <table>
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
        <tbody>
          {table.getRowModel().rows.map((row) => {
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
                  trackPlayer.playMusic(row.original);
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
