import { DownloadState } from "@/common/constant";
import { normalizeFileSize } from "@/common/normalize-util";
import Tag from "@/renderer/components/Tag";
import Downloader from "@/renderer/core/downloader";
import { IDownloadingItem } from "@/renderer/core/downloader/store";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import "./index.scss";

const columnHelper = createColumnHelper<IDownloadingItem>();
const columnDef = [
  columnHelper.accessor((_, index) => index + 1, {
    cell: (info) => info.getValue(),
    header: () => "#",
    id: "index",
    minSize: 40,
    maxSize: 40,
    size: 40,
  }),
  columnHelper.accessor("0.title", {
    header: "标题",
    size: 200,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),

  columnHelper.accessor("0.artist", {
    header: "作者",
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("0.album", {
    header: "专辑",
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor((info) => info[1], {
    header: "状态",
    size: 180,
    cell: (info) => {
      const downloadState = info.getValue();
      if (downloadState.state === DownloadState.WAITING) {
        return "等待中...";
      }
      if (downloadState.state === DownloadState.ERROR) {
        return (
          <span style={{ color: "var(--dangerColor, #FC5F5F)" }}>
            下载失败: {downloadState.msg}
          </span>
        );
      }
      if (downloadState.state === DownloadState.PENDING) {
        return (
          <span
            style={{
              color: "var(--infoColor, #0A95C8)",
            }}
          >
            {normalizeFileSize(downloadState.downloaded ?? 0)} /{" "}
            {normalizeFileSize(downloadState.total ?? 0)}
          </span>
        );
      }
    },
  }),
  columnHelper.accessor("0.platform", {
    header: "来源",
    size: 100,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
  }),
];

export default function Downloading() {
  const downloadingQueue = Downloader.useDownloadingQueue();

  const table = useReactTable({
    debugAll: false,
    data: downloadingQueue,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="downloading-container">
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
          {table.getRowModel().rows.map((dataItem) => {
            const row = dataItem.original;
            const [musicItem, downloadingState] = row;
            // todo 拆出一个组件
            return (
              <tr
                key={`${musicItem.platform}-${musicItem.id}`}
                // data-active={
                //   activeItems.length === 2
                //     ? isBetween(
                //         virtualItem.rowIndex,
                //         activeItems[0],
                //         activeItems[1]
                //       )
                //     : activeItems[0] === virtualItem.rowIndex
                // }

                onClick={() => {
                  // 如果点击的时候按下shift
                }}
              >
                {dataItem.getAllCells().map((cell) => (
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
    </div>
  );
}
