import { useRef } from "react";
import "./index.scss";
import { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

interface IMusicListProps {
  musicList: IMusic.IMusicItem[];
  currentPage?: number;
  pageSize?: number;
  totalPage?: number;
  onPageChange?: (page: number) => void;
}

export default function MusicList(props: IMusicListProps) {
  const { musicList } = props;

  const columnDefs = useRef<ColDef<IMusic.IMusicItem>[]>([
    {
      field: "id",
      headerName: "#",
      cellRenderer: (data: any) => <i>{data.rowIndex + 1}</i>,
      lockPosition: true,
      width: 56,
      maxWidth: 56,
      minWidth: 56,
      headerClass: "content-center",
      cellClass: "content-center",
    },
    {
      field: "title",
      headerName: "标题",
      flex: 2,
    },
    {
      field: "artist",
      headerName: "作者",
    },
    {
      field: "album",
      headerName: "专辑",
    },
    {
      field: "duration",
      headerName: "时长",
    },
    {
      colId: "extra",
      headerName: "操作",
      cellRenderer: () => <></>,
    },
  ]);

  return (
    <AgGridReact
      className="ag-theme-alpine music-list-container"
      rowDragEntireRow
      animateRows
      //   rowDragManaged
      //   rowDragText={(item) => {
      //     const data = item.rowNode.data;
      //     return data?.platform ?? "未命名插件";
      //   }}
      defaultColDef={{
        flex: 1,
        lockPosition: true,
        initialWidth: 0,
      }}
      suppressBrowserResizeObserver
      suppressMoveWhenRowDragging
      headerHeight={34}
      rowHeight={34}
      rowData={musicList}
      columnDefs={columnDefs.current}
      onCellContextMenu={(...e) => {
        console.log(e);
      }}

    ></AgGridReact>
  );
}
