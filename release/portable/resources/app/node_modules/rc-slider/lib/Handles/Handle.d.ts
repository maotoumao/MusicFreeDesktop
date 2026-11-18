import * as React from 'react';
import type { OnStartMove } from '../interface';
interface RenderProps {
    index: number;
    prefixCls: string;
    value: number;
    dragging: boolean;
}
export interface HandleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onFocus' | 'onMouseEnter'> {
    prefixCls: string;
    style?: React.CSSProperties;
    value: number;
    valueIndex: number;
    dragging: boolean;
    onStartMove: OnStartMove;
    onOffsetChange: (value: number | 'min' | 'max', valueIndex: number) => void;
    onFocus: (e: React.FocusEvent<HTMLDivElement>, index: number) => void;
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
    render?: (origin: React.ReactElement<React.HTMLAttributes<HTMLDivElement>>, props: RenderProps) => React.ReactElement;
    onChangeComplete?: () => void;
    mock?: boolean;
}
declare const Handle: React.ForwardRefExoticComponent<HandleProps & React.RefAttributes<HTMLDivElement>>;
export default Handle;
