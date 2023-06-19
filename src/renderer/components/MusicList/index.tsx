import { useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import "./index.scss";
import SvgAsset from "../SvgAsset";
import Tag from "../Tag";

interface IMusicListProps {
  musicList: IMusic.IMusicItem[];
  enablePagination?: boolean; // 分页/虚拟长列表
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
    cell: () => (
      <div className="music-list-like" role="button">
        <SvgAsset iconName="heart-outline"></SvgAsset>
      </div>
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
  }),
  columnHelper.accessor("platform", {
    header: "来源",
    size: 100,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
  }),
];

const columns = [
  {
    field: "id",
    headerName: "#",
    cellRenderer: (data: IMusic.IMusicItem, rowIndex: number) => (
      <i>{rowIndex + 1}</i>
    ),
    width: 56,
    maxWidth: 56,
    minWidth: 56,
  },
  {
    field: "title",
    headerName: "标题",
    flex: 2,
  },
  {
    field: "artist",
    headerName: "作者",
    flex: 1,
  },
  {
    field: "album",
    headerName: "专辑",
    flex: 1,
  },
  {
    field: "duration",
    headerName: "时长",
    flex: 1,
  },
  {
    colId: "extra",
    headerName: "操作",
    cellRenderer: () => <></>,
    flex: 1,
  },
];


export default function MusicList(props: IMusicListProps) {
  const { musicList } = props;
  console.log(musicList);

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
    </div>
  );
}
