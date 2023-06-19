import { pluginsStore } from "@/renderer/core/plugin-delegate";


import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import "./index.scss";

function renderOptions() {
  return <div>更新 卸载 导入歌单 导入单曲 分享</div>;
}

const columnHelper = createColumnHelper<IPlugin.IPluginSerializable>();
const columnDef = [
  columnHelper.accessor((row, index) => index + 1, {
    id: "id",
    cell(info) {
      return info.getValue();
    },
    header: () => "#",
    minSize: 64,
    maxSize: 64,
    size: 64
  }),
  columnHelper.accessor("platform", {
    cell: (info) => info.getValue(),
    header: () => "名称",
    minSize: 150,
    size: 200
  }),
  columnHelper.accessor("version", {
    cell: (info) => info.getValue(),
    header: () => "版本号",
    minSize: 100,
    maxSize: 100,
    size: 100
  }),
  columnHelper.accessor(() => 0, {
    id: "extra",
    cell: renderOptions,
    header: () => "操作",
    }),
];

export default function PluginTable() {
  const plugins = pluginsStore.useValue();
  const table = useReactTable({
    data: plugins,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });


  console.log(table, table.getHeaderGroups(), table.getRowModel().rows);

  return (
    <div className="plugin-table-wrapper">
      <table>
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <th key={header.id} style={{
                width: header.id === 'extra' ? undefined : header.getSize()
              }}>
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
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id} style={{
                  width: cell.column.getSize()
                }}>
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
