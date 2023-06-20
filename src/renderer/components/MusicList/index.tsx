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

interface IMusicListProps {
  musicList: IMusic.IMusicItem[];
  enablePagination?: boolean; // 分页/虚拟长列表
  enableSort?: boolean; // 拖拽排序
  onSortEnd?: () => void; // 排序结束
  currentPage?: number;
  pageSize?: number;
  totalPage?: number;
  onPageChange?: (page: number) => void;
}

const columnHelper = createColumnHelper<IMusic.IMusicItem>();
const columnDef = [
  columnHelper.display({
    id: "like",
    size: 32,
    cell: (info) => <MusicFavorite musicItem={info.row.original} size={18}></MusicFavorite>,
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
    cell: info => info.getValue() ? secondsToDuration(info.getValue()) : '--:--'
  }),
  columnHelper.accessor("platform", {
    header: "来源",
    size: 100,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
  }),
];



export default function MusicList(props: IMusicListProps) {
  const { musicList } = props;

  const table = useReactTable({
    debugAll: false,
    data: musicList,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="music-list-container">
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} onContextMenu={(e) => {
              console.log(e);
            }} onDoubleClick={() => {
              trackPlayer.playMusic(row.original)
            }}>
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
          ))}
        </tbody>
      </table>
      <Condition condition={musicList.length === 0}>
        <Empty></Empty>
      </Condition>
    </div>
  );
}
