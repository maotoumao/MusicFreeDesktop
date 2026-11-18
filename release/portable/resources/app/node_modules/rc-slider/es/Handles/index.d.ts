import * as React from 'react';
import type { OnStartMove } from '../interface';
import type { HandleProps } from './Handle';
export interface HandlesProps {
    prefixCls: string;
    style?: React.CSSProperties | React.CSSProperties[];
    values: number[];
    onStartMove: OnStartMove;
    onOffsetChange: (value: number | 'min' | 'max', valueIndex: number) => void;
    onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
    handleRender?: HandleProps['render'];
    /**
     * When config `activeHandleRender`,
     * it will render another hidden handle for active usage.
     * This is useful for accessibility or tooltip usage.
     */
    activeHandleRender?: HandleProps['render'];
    draggingIndex: number;
    onChangeComplete?: () => void;
}
export interface HandlesRef {
    focus: (index: number) => void;
}
declare const Handles: React.ForwardRefExoticComponent<HandlesProps & React.RefAttributes<HandlesRef>>;
export default Handles;
