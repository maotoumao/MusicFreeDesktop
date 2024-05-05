import { useCallback, useState, DragEvent } from "react";
import { IfTruthy } from "../Condition";
import "./index.scss";

interface IDragReceiverProps {
  // 位置：顶部/底部
  position: "top" | "bottom";
  // 当前响应器的下标
  rowIndex: number;
  // 释放事件
  onDrop?: (from: number, to: number) => void;
  /** 用来匹配拖拽源的tag */
  tag?: string;
  /** 是否需要td标签包裹 */
  insideTable?: boolean;
}

export default function DragReceiver(props: IDragReceiverProps) {
  const { position, rowIndex, onDrop, tag, insideTable } = props;
  const [draggingOver, setDraggingOver] = useState(false);

  const onDragOver = useCallback(() => {
    setDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggingOver(false);
  }, []);

  const contentComponent = (
    <div
      className={`components--drag-receiver components--drag-receiver-${[
        position,
      ]}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        const itemIndex = +e.dataTransfer.getData("itemIndex");
        const itemTag = e.dataTransfer.getData("itemTag");
        setDraggingOver(false);

        const _itemTag = (itemTag === "null" || itemTag === "undefined") ? null : `${itemTag}`;
        const _tag = tag ? `${tag}` : null;
        if (_itemTag !== _tag) {
          // tag 不一致 忽略
          return;
        }
        if (itemIndex >= 0) {
          onDrop?.(itemIndex, rowIndex);
        }
      }}
    >
      <IfTruthy condition={draggingOver}>
        <div className="components--drag-receiver-content"></div>
      </IfTruthy>
    </div>
  );

  return insideTable ? (
    <td className="components--drag-receiver-table-container">{contentComponent}</td>
  ) : (
    contentComponent
  );
}

export function startDrag(
  e: DragEvent,
  itemIndex: number | string,
  tag?: string
) {
  e.dataTransfer.setData("itemIndex", `${itemIndex}`);
  e.dataTransfer.setData("itemTag", tag ?? null);
}
