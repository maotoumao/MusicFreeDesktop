// src/renderer/components/DragReceiver/index.tsx
import { useCallback, useState, DragEvent } from "react";
import { IfTruthy } from "../Condition";
import "./index.scss";

interface IDragReceiverProps {
  position: "top" | "bottom";
  rowIndex: number;
  onDrop?: (from: number, to: number) => void;
  tag?: string;
  // insideTable 和 colSpan 不再需要，因为播放列表不是真正的 HTML 表格
}

export default function DragReceiver(props: IDragReceiverProps) {
  const { position, rowIndex, onDrop, tag } = props;
  const [draggingOver, setDraggingOver] = useState(false);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const itemIndex = +e.dataTransfer.getData("itemIndex");
    const itemTag = e.dataTransfer.getData("itemTag");
    setDraggingOver(false);

    const _itemTag = (itemTag === "null" || itemTag === "undefined") ? null : `${itemTag}`;
    const _tag = tag ? `${tag}` : null;
    if (_itemTag !== _tag) {
      return;
    }
    if (itemIndex >= 0) {
      onDrop?.(itemIndex, rowIndex);
    }
  }, [onDrop, rowIndex, tag]);

  // DragReceiver 总是渲染为一个 div，因为它用于虚拟列表，父级也是 div
  return (
    <div
      className={`components--drag-receiver components--drag-receiver-${position}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      style={{
        height: '12px', 
        width: '100%',
      }}
    >
      <IfTruthy condition={draggingOver}>
        <div className="components--drag-receiver-content"></div>
      </IfTruthy>
    </div>
  );
}

export function startDrag(
  e: DragEvent,
  itemIndex: number | string,
  tag?: string
) {
  e.dataTransfer.setData("itemIndex", `${itemIndex}`);
  e.dataTransfer.setData("itemTag", String(tag ?? 'null')); // 确保传递字符串
  e.dataTransfer.effectAllowed = "move";
}