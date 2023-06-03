import { pluginsStore } from "@/renderer/core/plugin-delegate";
import { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useRef } from "react";
import "./index.scss";


function renderOptions(){
    return <div>
        更新
        卸载
        导入歌单
        导入单曲
        分享

    </div>
}

export default function PluginTable() {
  const plugins = pluginsStore.useValue();

  const columnDefs = useRef<ColDef<IPlugin.IPluginSerializable>[]>([
    {
      field: "id",
      headerName: "#",
      cellRenderer: (data: any) => <i>{data.rowIndex + 1}</i>,
      lockPosition: true,
      width: 56,
      headerClass: "content-center",
      cellClass: "content-center",
    },
    {
      field: "platform",
      headerName: "名称",
      lockPosition: true,
    },
    {
      field: "version",
      headerName: "版本号",
      lockPosition: true,
    },
    {
      colId: "extra",
      headerName: "操作",
      flex: 1,
      cellRenderer: renderOptions
    },
  ]);

  return (
    <div className="ag-theme-alpine plugin-table-wrapper">
      <AgGridReact
        rowDragEntireRow
        animateRows
        rowDragManaged
        rowDragText={(item) => {
            const data = item.rowNode.data;
            return data?.platform ?? '未命名插件';
        }}
        suppressMoveWhenRowDragging
        headerHeight={34}
        rowHeight={34}
        rowData={plugins}
        columnDefs={columnDefs.current}
      ></AgGridReact>
    </div>
  );
}
