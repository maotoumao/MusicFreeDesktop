import React$1, { ElementType, ReactNode, CSSProperties, PropsWithChildren } from 'react';

type PlacesType =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'

type VariantType = 'dark' | 'light' | 'success' | 'warning' | 'error' | 'info'

type WrapperType = ElementType | 'div' | 'span'

type ChildrenType = Element | ElementType | ReactNode

type EventsType = 'hover' | 'click'

type PositionStrategy = 'absolute' | 'fixed'

type DataAttribute =
  | 'place'
  | 'content'
  | 'html'
  | 'variant'
  | 'offset'
  | 'wrapper'
  | 'events'
  | 'position-strategy'
  | 'delay-show'
  | 'delay-hide'
  | 'float'
  | 'hidden'
  | 'class-name'

/**
 * @description floating-ui middleware
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Middleware = any

interface IPosition {
  x: number
  y: number
}

interface TooltipImperativeOpenOptions {
  anchorSelect?: string
  position?: IPosition
  place?: PlacesType
  content?: ChildrenType
  /**
   * @description Delay (in ms) before opening the tooltip.
   */
  delay?: number
}

interface TooltipImperativeCloseOptions {
  /**
   * @description Delay (in ms) before closing the tooltip.
   */
  delay?: number
}

interface TooltipRefProps {
  open: (options?: TooltipImperativeOpenOptions) => void
  close: (options?: TooltipImperativeCloseOptions) => void
  /**
   * @readonly
   */
  activeAnchor: HTMLElement | null
  /**
   * @readonly
   */
  place: PlacesType
  /**
   * @readonly
   */
  isOpen: boolean
}

type AnchorOpenEvents = {
  mouseenter?: boolean
  focus?: boolean
  click?: boolean
  dblclick?: boolean
  mousedown?: boolean
}
type AnchorCloseEvents = {
  mouseleave?: boolean
  blur?: boolean
  click?: boolean
  dblclick?: boolean
  mouseup?: boolean
}
type GlobalCloseEvents = {
  escape?: boolean
  scroll?: boolean
  resize?: boolean
  clickOutsideAnchor?: boolean
}

interface ITooltipController {
  className?: string
  classNameArrow?: string
  content?: string
  /**
   * @deprecated Use `children` or `render` instead
   */
  html?: string
  render?: (render: { content: string | null; activeAnchor: HTMLElement | null }) => ChildrenType
  place?: PlacesType
  offset?: number
  id?: string
  variant?: VariantType
  /**
   * @deprecated Use the `data-tooltip-id` attribute, or the `anchorSelect` prop instead.
   * See https://react-tooltip.com/docs/getting-started
   */
  anchorId?: string
  anchorSelect?: string
  wrapper?: WrapperType
  children?: ChildrenType
  /**
   * @deprecated Use `openOnClick` or `openEvents`/`closeEvents` instead.
   */
  events?: EventsType[]
  openOnClick?: boolean
  positionStrategy?: PositionStrategy
  middlewares?: Middleware[]
  delayShow?: number
  delayHide?: number
  float?: boolean
  hidden?: boolean
  noArrow?: boolean
  clickable?: boolean
  /**
   * @deprecated Use `globalCloseEvents={{ escape: true }}` instead.
   */
  closeOnEsc?: boolean
  /**
   * @deprecated Use `globalCloseEvents={{ scroll: true }}` instead.
   */
  closeOnScroll?: boolean
  /**
   * @deprecated Use `globalCloseEvents={{ resize: true }}` instead.
   */
  closeOnResize?: boolean
  /**
   * @description The events to be listened on anchor elements to open the tooltip.
   */
  openEvents?: AnchorOpenEvents
  /**
   * @description The events to be listened on anchor elements to close the tooltip.
   */
  closeEvents?: AnchorCloseEvents
  /**
   * @description The global events listened to close the tooltip.
   */
  globalCloseEvents?: GlobalCloseEvents
  /**
   * @description Used to disable default tooltip behavior.
   * Overrides `openEvents`, `closeEvents`, and `globalCloseEvents`.
   */
  imperativeModeOnly?: boolean
  style?: CSSProperties
  position?: IPosition
  isOpen?: boolean
  defaultIsOpen?: boolean
  disableStyleInjection?: boolean | 'core'
  /**
   * @description see https://developer.mozilla.org/en-US/docs/Web/CSS/border.
   *
   * Adding a border with width > 3px, or with `em/cm/rem/...` instead of `px`
   * might break the tooltip arrow positioning.
   */
  border?: CSSProperties['border']
  opacity?: CSSProperties['opacity']
  arrowColor?: CSSProperties['backgroundColor']
  setIsOpen?: (value: boolean) => void
  afterShow?: () => void
  afterHide?: () => void
  role?: React.AriaRole
}

declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    'data-tooltip-id'?: string
    'data-tooltip-place'?: PlacesType
    'data-tooltip-content'?: string | null
    'data-tooltip-html'?: string | null
    'data-tooltip-variant'?: VariantType
    'data-tooltip-offset'?: number
    'data-tooltip-wrapper'?: WrapperType
    /**
     * @deprecated Use `openOnClick` tooltip prop instead.
     */
    'data-tooltip-events'?: EventsType[]
    'data-tooltip-position-strategy'?: PositionStrategy
    'data-tooltip-delay-show'?: number
    'data-tooltip-delay-hide'?: number
    'data-tooltip-float'?: boolean
    'data-tooltip-hidden'?: boolean
    'data-tooltip-class-name'?: string
  }
}

/**
 * @deprecated Use the `data-tooltip-id` attribute, or the `anchorSelect` prop instead.
 * See https://react-tooltip.com/docs/getting-started
 */
interface ITooltipWrapper {
  tooltipId?: string
  children: ReactNode
  className?: string

  place?: ITooltipController['place']
  content?: ITooltipController['content']
  html?: ITooltipController['html']
  variant?: ITooltipController['variant']
  offset?: ITooltipController['offset']
  wrapper?: ITooltipController['wrapper']
  events?: ITooltipController['events']
  positionStrategy?: ITooltipController['positionStrategy']
  delayShow?: ITooltipController['delayShow']
  delayHide?: ITooltipController['delayHide']
}

declare const TooltipController: React$1.ForwardRefExoticComponent<ITooltipController & React$1.RefAttributes<TooltipRefProps>>;

/**
 * @deprecated Use the `data-tooltip-id` attribute, or the `anchorSelect` prop instead.
 * See https://react-tooltip.com/docs/getting-started
 */
declare const TooltipProvider: React$1.FC<PropsWithChildren<void>>;

/**
 * @deprecated Use the `data-tooltip-id` attribute, or the `anchorSelect` prop instead.
 * See https://react-tooltip.com/docs/getting-started
 */
declare const TooltipWrapper: ({ tooltipId, children, className, place, content, html, variant, offset, wrapper, events, positionStrategy, delayShow, delayHide, }: ITooltipWrapper) => React$1.JSX.Element;

/**
 * @deprecated Use the `disableStyleInjection` tooltip prop instead.
 * See https://react-tooltip.com/docs/examples/styling#disabling-reacttooltip-css
 */
declare function removeStyle({ type, id, }?: {
    type?: 'core' | 'base';
    id?: string;
}): void;

export { ChildrenType, DataAttribute, EventsType, IPosition, ITooltipController as ITooltip, ITooltipWrapper, Middleware, PlacesType, PositionStrategy, TooltipController as Tooltip, TooltipProvider, TooltipRefProps, TooltipWrapper, VariantType, WrapperType, removeStyle };
