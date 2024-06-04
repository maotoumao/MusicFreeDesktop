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
import { i18n } from "@/shared/i18n/renderer";

const columnHelper = createColumnHelper<IDownloadingItem>();

const { t } = i18n;
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
    header: () => t("media.media_title"),
    size: 200,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),

  columnHelper.accessor("0.artist", {
    header: () => t("media.media_type_artist"),
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("0.album", {
    header: () => t("media.media_type_album"),
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor((info) => info[1], {
    header: () => t("common.status"),
    size: 180,
    id: "status",
    cell: (info) => {
      const downloadState = info.getValue();
      if (downloadState.state === DownloadState.WAITING) {
        return t("download_page.waiting");
      }
      if (downloadState.state === DownloadState.ERROR) {
        return (
          <span style={{ color: "var(--dangerColor, #FC5F5F)" }}>
            {t("download_page.failed")}: {downloadState.msg}
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
    header: () => t("media.media_platform"),
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
