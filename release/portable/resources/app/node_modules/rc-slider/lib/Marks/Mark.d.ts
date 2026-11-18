import * as React from 'react';
export interface MarkProps {
    prefixCls: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    value: number;
    onClick: (value: number) => void;
}
declare const Mark: React.FC<MarkProps>;
export default Mark;
