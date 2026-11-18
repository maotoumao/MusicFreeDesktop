import { Component, ErrorInfo } from "react";
import { ErrorBoundaryProps } from "./types.js";
type ErrorBoundaryState = {
    didCatch: true;
    error: any;
} | {
    didCatch: false;
    error: null;
};
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): {
        didCatch: boolean;
        error: Error;
    };
    resetErrorBoundary(...args: any[]): void;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void;
    render(): import("react").FunctionComponentElement<import("react").ProviderProps<import("./ErrorBoundaryContext.js").ErrorBoundaryContextType | null>>;
}
export {};
