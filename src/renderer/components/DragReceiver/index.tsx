// src/renderer/components/DragReceiver/index.tsx
import { useCallback, useState, DragEvent, ReactNode } from "react";
import { IfTruthy } from "../Condition";
import "./index.scss";

interface IDragReceiverProps {
  position: "top" | "bottom";
  rowIndex: number;
  onDrop?: (from: number, to: number) => void;
  tag?: string;
  insideTable?: boolean;
  colSpan?: number; // 新增 colSpan，用于 td
}

export default function DragReceiver(props: IDragReceiverProps) {
  const { position, rowIndex, onDrop, tag, insideTable, colSpan } = props;
  const [draggingOver, setDraggingOver] = useState(false);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement> | DragEvent<HTMLTableRowElement>) => { // 明确类型
    e.preventDefault(); // 必须阻止默认行为才能触发 onDrop
    setDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement> | DragEvent<HTMLTableRowElement>) => { // 明确类型
    e.preventDefault(); // 确保也在这里阻止默认行为
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


  const contentComponent = (
    <div
      className={`components--drag-receiver-content-wrapper components--drag-receiver-${position}`} // 外层 div 用于定位和事件处理
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      // 对于非表格情况，这个 div 就是事件接收者
      // 对于表格情况，事件应绑定在 tr 或 td 上
    >
      <IfTruthy condition={draggingOver}>
        <div className="components--drag-receiver-content"></div>
      </IfTruthy>
    </div>
  );

  if (insideTable) {
    // 如果在表格内，DragReceiver 应该渲染为一个完整的行，或者被放置在一个 td 内
    // 这里我们假设它自己渲染为一个带有占位td的行，或者一个特殊的td
    return (
      <tr 
        className={`components--drag-receiver components--drag-receiver-${position}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        style={{ height: '12px', position: 'relative' }} // 给 tr 设置高度和相对定位
      >
        <td 
          colSpan={colSpan || 1} // 使用传入的 colSpan 或默认为1
          style={{ padding: 0, border: 'none', height: '100%', position: 'relative' }} // td 样式
        >
          <IfTruthy condition={draggingOver}>
            <div className="components--drag-receiver-content" style={{position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)'}}></div>
          </IfTruthy>
        </td>
      </tr>
    );
  } else {
    return contentComponent; // 对于非表格情况，直接渲染 contentComponent (一个 div)
  }
}

export function startDrag(
  e: DragEvent,
  itemIndex: number | string,
  tag?: string
) {
  e.dataTransfer.setData("itemIndex", `${itemIndex}`);
  e.dataTransfer.setData("itemTag", tag ?? null); // 确保 tag 为 null 或 undefined 时传递字符串 "null" 或 "undefined"
  e.dataTransfer.effectAllowed = "move"; // 明确拖动效果
}