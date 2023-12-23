import {
  callPluginDelegateMethod,
  useSortedPlugins,
} from "@/renderer/core/plugin-delegate";

import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import "./index.scss";
import { CSSProperties, ReactNode } from "react";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import { hideModal, showModal } from "@/renderer/components/Modal";
import Empty from "@/renderer/components/Empty";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import { toast } from "react-toastify";
import { showPanel } from "@/renderer/components/Panel";
import rendererAppConfig from "@/common/app-config/renderer";
import DragReceiver, { startDrag } from "@/renderer/components/DragReceiver";
import { produce } from "immer";

function renderOptions(info: any) {
  const row = info.row.original as IPlugin.IPluginDelegate;

  return (
    <div>
      <ActionButton
        style={{
          color: "var(--dangerColor, #FC5F5F)",
        }}
        onClick={() => {
          showModal("Reconfirm", {
            title: "卸载插件",
            content: `确认卸载插件「${row.platform}」吗?`,
            async onConfirm() {
              hideModal();
              try {
                await ipcRendererInvoke("uninstall-plugin", row.hash);
                toast.success(`已卸载「${row.platform}」`);
              } catch {
                toast.error("卸载失败");
              }
            },
          });
        }}
      >
        卸载
      </ActionButton>
      <Condition condition={row.srcUrl}>
        <ActionButton
          style={{
            color: "var(--successColor, #08A34C)",
          }}
          onClick={async () => {
            try {
              await ipcRendererInvoke("install-plugin-remote", row.srcUrl);
              toast.success(`插件「${row.platform}」已更新至最新版本`);
            } catch (e) {
              toast.error(e?.message ?? "更新失败");
            }
          }}
        >
          更新
        </ActionButton>
      </Condition>

      <Condition condition={row.supportedMethod.includes("importMusicItem")}>
        <ActionButton
          style={{
            color: "var(--infoColor, #0A95C8)",
          }}
          onClick={() => {
            showModal("SimpleInputWithState", {
              title: "导入单曲",
              withLoading: true,
              loadingText: "正在导入中",
              placeholder: `输入${row.platform}单曲链接`,
              maxLength: 1000,
              onOk(text) {
                return callPluginDelegateMethod(
                  row,
                  "importMusicItem",
                  text.trim()
                );
              },
              onPromiseResolved(result) {
                hideModal();
                showModal("AddMusicToSheet", {
                  musicItems: result as IMusic.IMusicItem[],
                });
              },
              onPromiseRejected() {
                console.log("导入失败");
              },
              hints: row.hints?.importMusicItem,
            });
          }}
        >
          导入单曲
        </ActionButton>
      </Condition>
      <Condition condition={row.supportedMethod.includes("importMusicSheet")}>
        <ActionButton
          style={{
            color: "#0A95C8",
          }}
          onClick={() => {
            showModal("SimpleInputWithState", {
              title: "导入歌单",
              withLoading: true,
              loadingText: "正在导入中",
              placeholder: `输入${row.platform}歌单链接`,
              maxLength: 1000,
              onOk(text) {
                return callPluginDelegateMethod(
                  row,
                  "importMusicSheet",
                  text.trim()
                );
              },
              onPromiseResolved(result) {
                hideModal();
                showModal("AddMusicToSheet", {
                  musicItems: result as IMusic.IMusicItem[],
                });
              },
              onPromiseRejected() {
                console.log("导入失败");
                toast.error("导入歌单失败！");
              },
              hints: row.hints?.importMusicSheet,
            });
          }}
        >
          导入歌单
        </ActionButton>
      </Condition>
      <Condition condition={row.userVariables?.length}>
        <ActionButton
          style={{
            color: "#0A95C8",
          }}
          onClick={() => {
            showPanel("UserVariables", {
              variables: row.userVariables,
              plugin: row,
              initValues:
                rendererAppConfig.getAppConfigPath("private.pluginMeta")?.[
                  row.platform
                ]?.userVariables,
            });
          }}
        >
          用户变量
        </ActionButton>
      </Condition>
    </div>
  );
}

const columnHelper = createColumnHelper<IPlugin.IPluginDelegate>();
const columnDef = [
  columnHelper.accessor((row, index) => index + 1, {
    id: "id",
    cell(info) {
      return info.getValue();
    },
    header: () => "#",
    minSize: 64,
    maxSize: 64,
    size: 64,
  }),
  columnHelper.accessor("platform", {
    cell: (info) => info.getValue(),
    header: () => "名称",
    minSize: 150,
    size: 200,
  }),
  columnHelper.accessor("version", {
    cell: (info) => info.getValue(),
    header: () => "版本号",
    minSize: 100,
    maxSize: 100,
    size: 100,
  }),
  columnHelper.accessor("author", {
    cell: (info) => info.getValue() ?? '未知作者',
    header: () => "作者",
    maxSize: 100,
    minSize: 100,
    size: 100,
  }),
  columnHelper.accessor(() => 0, {
    id: "extra",
    cell: renderOptions,
    header: () => "操作",
  }),
];

export default function PluginTable() {
  const plugins = useSortedPlugins();
  const table = useReactTable({
    data: plugins,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  function onDrop(fromIndex: number, toIndex: number) {
    const meta = rendererAppConfig.getAppConfigPath("private.pluginMeta") ?? {};

    const newPlugins = plugins
      .slice(0, fromIndex)
      .concat(plugins.slice(fromIndex + 1));
    newPlugins.splice(
      fromIndex < toIndex ? toIndex - 1 : toIndex,
      0,
      plugins[fromIndex]
    );

    const newMeta = produce(meta, (draft) => {
      newPlugins.forEach((plugin, index) => {
        if (!draft[plugin.platform]) {
          draft[plugin.platform] = {};
        }
        draft[plugin.platform].order = index;
      });
    });

    rendererAppConfig.setAppConfigPath("private.pluginMeta", newMeta);
  }

  return (
    <div className="plugin-table--container">
      <Condition
        condition={table.getRowModel().rows.length}
        falsy={<Empty></Empty>}
      >
        <table>
          <thead>
            <tr>
              {table.getHeaderGroups()[0].headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    width: header.id === "extra" ? "100%" : header.getSize(),
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
            {table.getRowModel().rows.map((row, index) => (
              <tr
                key={row.id}
                draggable
                onDragStart={(e) => {
                  startDrag(e, index);
                }}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <IfTruthy condition={index === 0}>
                  <DragReceiver
                    position="top"
                    rowIndex={0}
                    insideTable
                    onDrop={onDrop}
                  ></DragReceiver>
                </IfTruthy>
                <DragReceiver
                  position="bottom"
                  rowIndex={index + 1}
                  insideTable
                  onDrop={onDrop}
                ></DragReceiver>
              </tr>
            ))}
          </tbody>
        </table>
      </Condition>
    </div>
  );
}

interface IActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}
function ActionButton(props: IActionButtonProps) {
  const { children, onClick, style } = props;
  return (
    <span className="action-button" onClick={onClick} style={style}>
      {children}
    </span>
  );
}
