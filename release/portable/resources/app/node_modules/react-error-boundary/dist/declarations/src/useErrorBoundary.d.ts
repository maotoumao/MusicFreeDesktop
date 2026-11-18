export type UseErrorBoundaryApi<TError> = {
    resetBoundary: () => void;
    showBoundary: (error: TError) => void;
};
export declare function useErrorBoundary<TError = any>(): UseErrorBoundaryApi<TError>;
