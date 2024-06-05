import Tag from "@/renderer/components/Tag";
import Downloader from "@/renderer/core/downloader";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import "./index.scss";
import { i18n } from "@/shared/i18n/renderer";
import useVirtualList from "@/renderer/hooks/useVirtualList";
import DownloadStatus from "./DownloadStatus";

const columnHelper = createColumnHelper<IMusic.IMusicItem>();

const estimizeItemHeight = 2.6 * 13; // lineheight 2.6rem

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
  columnHelper.accessor("title", {
    header: () => t("media.media_title"),
    size: 200,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),

  columnHelper.accessor("artist", {
    header: () => t("media.media_type_artist"),
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("album", {
    header: () => t("media.media_type_album"),
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.display({
    header: () => t("common.status"),
    size: 180,
    id: "status",
    cell: (info) => {
      return <DownloadStatus musicItem={info.row.original}></DownloadStatus>;
    },
  }),
  columnHelper.accessor("platform", {
    header: () => t("media.media_platform"),
    size: 100,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
  }),
];

export default function Downloading() {
  const downloadingQueue = Downloader.useDownloadingMusicList();

  const table = useReactTable({
    debugAll: false,
    data: downloadingQueue,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  const virtualController = useVirtualList({
    data: table.getRowModel().rows,
    scrollElementQuery: "#page-container",
    estimizeItemHeight,
  });

  return (
    <div className="downloading-container">
      <table
        style={{
          tableLayout: "fixed",
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
          {virtualController.virtualItems.map((virtualItem, index) => {
            const dataItem = virtualItem.dataItem;
            const musicItem = dataItem.original;
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
        <tfoot
          style={{
            height:
              virtualController.totalHeight -
              virtualController.virtualItems.length * estimizeItemHeight,
          }}
        ></tfoot>
      </table>
    </div>
  );
}
