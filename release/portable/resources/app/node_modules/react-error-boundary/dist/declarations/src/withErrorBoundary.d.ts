import { RefAttributes, ForwardRefExoticComponent, PropsWithoutRef, ComponentType, ComponentRef, ComponentProps } from "react";
import { ErrorBoundaryProps } from "./types.js";
export declare function withErrorBoundary<T extends ComponentType<any>>(component: T, errorBoundaryProps: ErrorBoundaryProps): ForwardRefExoticComponent<PropsWithoutRef<ComponentProps<T>> & RefAttributes<ComponentRef<T>>>;
