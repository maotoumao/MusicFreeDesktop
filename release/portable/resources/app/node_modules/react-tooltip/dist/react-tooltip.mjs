
/*
* React Tooltip
* {@link https://github.com/ReactTooltip/react-tooltip}
* @copyright ReactTooltip Team
* @license MIT
*/
import React, { useLayoutEffect, useEffect, createContext, useState, useCallback, useMemo, useContext, useRef, useImperativeHandle } from 'react';
import { arrow, computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
import classNames from 'classnames';

// This is the ID for the core styles of ReactTooltip
const REACT_TOOLTIP_CORE_STYLES_ID = 'react-tooltip-core-styles';
// This is the ID for the visual styles of ReactTooltip
const REACT_TOOLTIP_BASE_STYLES_ID = 'react-tooltip-base-styles';
const injected = {
    core: false,
    base: false,
};
function injectStyle({ css, id = REACT_TOOLTIP_BASE_STYLES_ID, type = 'base', ref, }) {
    var _a, _b;
    if (!css || typeof document === 'undefined' || injected[type]) {
        return;
    }
    if (type === 'core' &&
        typeof process !== 'undefined' && // this validation prevents docs from breaking even with `process?`
        ((_a = process === null || process === void 0 ? void 0 : process.env) === null || _a === void 0 ? void 0 : _a.REACT_TOOLTIP_DISABLE_CORE_STYLES)) {
        return;
    }
    if (type !== 'base' &&
        typeof process !== 'undefined' && // this validation prevents docs from breaking even with `process?`
        ((_b = process === null || process === void 0 ? void 0 : process.env) === null || _b === void 0 ? void 0 : _b.REACT_TOOLTIP_DISABLE_BASE_STYLES)) {
        return;
    }
    if (type === 'core') {
        // eslint-disable-next-line no-param-reassign
        id = REACT_TOOLTIP_CORE_STYLES_ID;
    }
    if (!ref) {
        // eslint-disable-next-line no-param-reassign
        ref = {};
    }
    const { insertAt } = ref;
    if (document.getElementById(id)) {
        // this should never happen because of `injected[type]`
        {
            // eslint-disable-next-line no-console
            console.warn(`[react-tooltip] Element with id '${id}' already exists. Call \`removeStyle()\` first`);
        }
        return;
    }
    const head = document.head || document.getElementsByTagName('head')[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const style = document.createElement('style');
    style.id = id;
    style.type = 'text/css';
    if (insertAt === 'top') {
        if (head.firstChild) {
            head.insertBefore(style, head.firstChild);
        }
        else {
            head.appendChild(style);
        }
    }
    else {
        head.appendChild(style);
    }
    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    }
    else {
        style.appendChild(document.createTextNode(css));
    }
    injected[type] = true;
}
/**
 * @deprecated Use the `disableStyleInjection` tooltip prop instead.
 * See https://react-tooltip.com/docs/examples/styling#disabling-reacttooltip-css
 */
function removeStyle({ type = 'base', id = REACT_TOOLTIP_BASE_STYLES_ID, } = {}) {
    if (!injected[type]) {
        return;
    }
    if (type === 'core') {
        // eslint-disable-next-line no-param-reassign
        id = REACT_TOOLTIP_CORE_STYLES_ID;
    }
    const style = document.getElementById(id);
    if ((style === null || style === void 0 ? void 0 : style.tagName) === 'style') {
        style === null || style === void 0 ? void 0 : style.remove();
    }
    else {
        // eslint-disable-next-line no-console
        console.warn(`[react-tooltip] Failed to remove 'style' element with id '${id}'. Call \`injectStyle()\` first`);
    }
    injected[type] = false;
}

const computeTooltipPosition = async ({ elementReference = null, tooltipReference = null, tooltipArrowReference = null, place = 'top', offset: offsetValue = 10, strategy = 'absolute', middlewares = [
    offset(Number(offsetValue)),
    flip({
        fallbackAxisSideDirection: 'start',
    }),
    shift({ padding: 5 }),
], border, }) => {
    if (!elementReference) {
        // elementReference can be null or undefined and we will not compute the position
        // eslint-disable-next-line no-console
        // console.error('The reference element for tooltip was not defined: ', elementReference)
        return { tooltipStyles: {}, tooltipArrowStyles: {}, place };
    }
    if (tooltipReference === null) {
        return { tooltipStyles: {}, tooltipArrowStyles: {}, place };
    }
    const middleware = middlewares;
    if (tooltipArrowReference) {
        middleware.push(arrow({ element: tooltipArrowReference, padding: 5 }));
        return computePosition(elementReference, tooltipReference, {
            placement: place,
            strategy,
            middleware,
        }).then(({ x, y, placement, middlewareData }) => {
            var _a, _b;
            const styles = { left: `${x}px`, top: `${y}px`, border };
            /* c8 ignore start */
            const { x: arrowX, y: arrowY } = (_a = middlewareData.arrow) !== null && _a !== void 0 ? _a : { x: 0, y: 0 };
            const staticSide = (_b = {
                top: 'bottom',
                right: 'left',
                bottom: 'top',
                left: 'right',
            }[placement.split('-')[0]]) !== null && _b !== void 0 ? _b : 'bottom';
            /* c8 ignore end */
            const borderSide = border && {
                borderBottom: border,
                borderRight: border,
            };
            let borderWidth = 0;
            if (border) {
                const match = `${border}`.match(/(\d+)px/);
                if (match === null || match === void 0 ? void 0 : match[1]) {
                    borderWidth = Number(match[1]);
                }
                else {
                    /**
                     * this means `border` was set without `width`,
                     * or non-px value (such as `medium`, `thick`, ...)
                     */
                    borderWidth = 1;
                }
            }
            /* c8 ignore start */
            const arrowStyle = {
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                right: '',
                bottom: '',
                ...borderSide,
                [staticSide]: `-${4 + borderWidth}px`,
            };
            /* c8 ignore end */
            return { tooltipStyles: styles, tooltipArrowStyles: arrowStyle, place: placement };
        });
    }
    return computePosition(elementReference, tooltipReference, {
        placement: 'bottom',
        strategy,
        middleware,
    }).then(({ x, y, placement }) => {
        const styles = { left: `${x}px`, top: `${y}px` };
        return { tooltipStyles: styles, tooltipArrowStyles: {}, place: placement };
    });
};

const cssSupports = (property, value) => {
    const hasCssSupports = 'CSS' in window && 'supports' in window.CSS;
    return hasCssSupports ? window.CSS.supports(property, value) : true;
};

const cssTimeToMs = (time) => {
    const match = time.match(/^([\d.]+)(ms|s)$/);
    if (!match) {
        return 0;
    }
    const [, amount, unit] = match;
    return Number(amount) * (unit === 'ms' ? 1 : 1000);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * This function debounce the received function
 * @param { function } 	func				Function to be debounced
 * @param { number } 		wait				Time to wait before execut the function
 * @param { boolean } 	immediate		Param to define if the function will be executed immediately
 */
const debounce = (func, wait, immediate) => {
    let timeout = null;
    const debounced = function debounced(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) {
                func.apply(this, args);
            }
        };
        if (immediate && !timeout) {
            /**
             * there's no need to clear the timeout
             * since we expect it to resolve and set `timeout = null`
             */
            func.apply(this, args);
            timeout = setTimeout(later, wait);
        }
        if (!immediate) {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(later, wait);
        }
    };
    debounced.cancel = () => {
        /* c8 ignore start */
        if (!timeout) {
            return;
        }
        /* c8 ignore end */
        clearTimeout(timeout);
        timeout = null;
    };
    return debounced;
};

const isObject = (object) => {
    return object !== null && !Array.isArray(object) && typeof object === 'object';
};
const deepEqual = (object1, object2) => {
    if (object1 === object2) {
        return true;
    }
    if (Array.isArray(object1) && Array.isArray(object2)) {
        if (object1.length !== object2.length) {
            return false;
        }
        return object1.every((val, index) => deepEqual(val, object2[index]));
    }
    if (Array.isArray(object1) !== Array.isArray(object2)) {
        return false;
    }
    if (!isObject(object1) || !isObject(object2)) {
        return object1 === object2;
    }
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    return keys1.every((key) => deepEqual(object1[key], object2[key]));
};

const isScrollable = (node) => {
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
        return false;
    }
    const style = getComputedStyle(node);
    return ['overflow', 'overflow-x', 'overflow-y'].some((propertyName) => {
        const value = style.getPropertyValue(propertyName);
        return value === 'auto' || value === 'scroll';
    });
};
const getScrollParent = (node) => {
    if (!node) {
        return null;
    }
    let currentParent = node.parentElement;
    while (currentParent) {
        if (isScrollable(currentParent)) {
            return currentParent;
        }
        currentParent = currentParent.parentElement;
    }
    return document.scrollingElement || document.documentElement;
};

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const DEFAULT_TOOLTIP_ID = 'DEFAULT_TOOLTIP_ID';
const DEFAULT_CONTEXT_DATA = {
    anchorRefs: new Set(),
    activeAnchor: { current: null },
    attach: () => {
        /* attach anchor element */
    },
    detach: () => {
        /* detach anchor element */
    },
    setActiveAnchor: () => {
        /* set active anchor */
    },
};
const DEFAULT_CONTEXT_DATA_WRAPPER = {
    getTooltipData: () => DEFAULT_CONTEXT_DATA,
};
const TooltipContext = createContext(DEFAULT_CONTEXT_DATA_WRAPPER);
/**
 * @deprecated Use the `data-tooltip-id` attribute, or the `anchorSelect` prop instead.
 * See https://react-tooltip.com/docs/getting-started
 */
const TooltipProvider = ({ children }) => {
    const [anchorRefMap, setAnchorRefMap] = useState({
        [DEFAULT_TOOLTIP_ID]: new Set(),
    });
    const [activeAnchorMap, setActiveAnchorMap] = useState({
        [DEFAULT_TOOLTIP_ID]: { current: null },
    });
    const attach = (tooltipId, ...refs) => {
        setAnchorRefMap((oldMap) => {
            var _a;
            const tooltipRefs = (_a = oldMap[tooltipId]) !== null && _a !== void 0 ? _a : new Set();
            refs.forEach((ref) => tooltipRefs.add(ref));
            // create new object to trigger re-render
            return { ...oldMap, [tooltipId]: new Set(tooltipRefs) };
        });
    };
    const detach = (tooltipId, ...refs) => {
        setAnchorRefMap((oldMap) => {
            const tooltipRefs = oldMap[tooltipId];
            if (!tooltipRefs) {
                // tooltip not found
                // maybe thow error?
                return oldMap;
            }
            refs.forEach((ref) => tooltipRefs.delete(ref));
            // create new object to trigger re-render
            return { ...oldMap };
        });
    };
    const setActiveAnchor = (tooltipId, ref) => {
        setActiveAnchorMap((oldMap) => {
            var _a;
            if (((_a = oldMap[tooltipId]) === null || _a === void 0 ? void 0 : _a.current) === ref.current) {
                return oldMap;
            }
            // create new object to trigger re-render
            return { ...oldMap, [tooltipId]: ref };
        });
    };
    const getTooltipData = useCallback((tooltipId = DEFAULT_TOOLTIP_ID) => {
        var _a, _b;
        return ({
            anchorRefs: (_a = anchorRefMap[tooltipId]) !== null && _a !== void 0 ? _a : new Set(),
            activeAnchor: (_b = activeAnchorMap[tooltipId]) !== null && _b !== void 0 ? _b : { current: null },
            attach: (...refs) => attach(tooltipId, ...refs),
            detach: (...refs) => detach(tooltipId, ...refs),
            setActiveAnchor: (ref) => setActiveAnchor(tooltipId, ref),
        });
    }, [anchorRefMap, activeAnchorMap, attach, detach]);
    const context = useMemo(() => {
        return {
            getTooltipData,
        };
    }, [getTooltipData]);
    return React.createElement(TooltipContext.Provider, { value: context }, children);
};
function useTooltip(tooltipId = DEFAULT_TOOLTIP_ID) {
    return useContext(TooltipContext).getTooltipData(tooltipId);
}

/**
 * @deprecated Use the `data-tooltip-id` attribute, or the `anchorSelect` prop instead.
 * See https://react-tooltip.com/docs/getting-started
 */
const TooltipWrapper = ({ tooltipId, children, className, place, content, html, variant, offset, wrapper, events, positionStrategy, delayShow, delayHide, }) => {
    const { attach, detach } = useTooltip(tooltipId);
    const anchorRef = useRef(null);
    useEffect(() => {
        attach(anchorRef);
        return () => {
            detach(anchorRef);
        };
    }, []);
    return (React.createElement("span", { ref: anchorRef, className: classNames('react-tooltip-wrapper', className), "data-tooltip-place": place, "data-tooltip-content": content, "data-tooltip-html": html, "data-tooltip-variant": variant, "data-tooltip-offset": offset, "data-tooltip-wrapper": wrapper, "data-tooltip-events": events, "data-tooltip-position-strategy": positionStrategy, "data-tooltip-delay-show": delayShow, "data-tooltip-delay-hide": delayHide }, children));
};

var coreStyles = {"tooltip":"core-styles-module_tooltip__3vRRp","fixed":"core-styles-module_fixed__pcSol","arrow":"core-styles-module_arrow__cvMwQ","noArrow":"core-styles-module_noArrow__xock6","clickable":"core-styles-module_clickable__ZuTTB","show":"core-styles-module_show__Nt9eE","closing":"core-styles-module_closing__sGnxF"};

var styles = {"tooltip":"styles-module_tooltip__mnnfp","arrow":"styles-module_arrow__K0L3T","dark":"styles-module_dark__xNqje","light":"styles-module_light__Z6W-X","success":"styles-module_success__A2AKt","warning":"styles-module_warning__SCK0X","error":"styles-module_error__JvumD","info":"styles-module_info__BWdHW"};

const Tooltip = ({ 
// props
forwardRef, id, className, classNameArrow, variant = 'dark', anchorId, anchorSelect, place = 'top', offset = 10, events = ['hover'], openOnClick = false, positionStrategy = 'absolute', middlewares, wrapper: WrapperElement, delayShow = 0, delayHide = 0, float = false, hidden = false, noArrow = false, clickable = false, closeOnEsc = false, closeOnScroll = false, closeOnResize = false, openEvents, closeEvents, globalCloseEvents, imperativeModeOnly, style: externalStyles, position, afterShow, afterHide, 
// props handled by controller
content, contentWrapperRef, isOpen, defaultIsOpen = false, setIsOpen, activeAnchor, setActiveAnchor, border, opacity, arrowColor, role = 'tooltip', }) => {
    var _a;
    const tooltipRef = useRef(null);
    const tooltipArrowRef = useRef(null);
    const tooltipShowDelayTimerRef = useRef(null);
    const tooltipHideDelayTimerRef = useRef(null);
    const missedTransitionTimerRef = useRef(null);
    const [computedPosition, setComputedPosition] = useState({
        tooltipStyles: {},
        tooltipArrowStyles: {},
        place,
    });
    const [show, setShow] = useState(false);
    const [rendered, setRendered] = useState(false);
    const [imperativeOptions, setImperativeOptions] = useState(null);
    const wasShowing = useRef(false);
    const lastFloatPosition = useRef(null);
    /**
     * @todo Remove this in a future version (provider/wrapper method is deprecated)
     */
    const { anchorRefs, setActiveAnchor: setProviderActiveAnchor } = useTooltip(id);
    const hoveringTooltip = useRef(false);
    const [anchorsBySelect, setAnchorsBySelect] = useState([]);
    const mounted = useRef(false);
    /**
     * @todo Update when deprecated stuff gets removed.
     */
    const shouldOpenOnClick = openOnClick || events.includes('click');
    const hasClickEvent = shouldOpenOnClick || (openEvents === null || openEvents === void 0 ? void 0 : openEvents.click) || (openEvents === null || openEvents === void 0 ? void 0 : openEvents.dblclick) || (openEvents === null || openEvents === void 0 ? void 0 : openEvents.mousedown);
    const actualOpenEvents = openEvents
        ? { ...openEvents }
        : {
            mouseenter: true,
            focus: true,
            click: false,
            dblclick: false,
            mousedown: false,
        };
    if (!openEvents && shouldOpenOnClick) {
        Object.assign(actualOpenEvents, {
            mouseenter: false,
            focus: false,
            click: true,
        });
    }
    const actualCloseEvents = closeEvents
        ? { ...closeEvents }
        : {
            mouseleave: true,
            blur: true,
            click: false,
            dblclick: false,
            mouseup: false,
        };
    if (!closeEvents && shouldOpenOnClick) {
        Object.assign(actualCloseEvents, {
            mouseleave: false,
            blur: false,
        });
    }
    const actualGlobalCloseEvents = globalCloseEvents
        ? { ...globalCloseEvents }
        : {
            escape: closeOnEsc || false,
            scroll: closeOnScroll || false,
            resize: closeOnResize || false,
            clickOutsideAnchor: hasClickEvent || false,
        };
    if (imperativeModeOnly) {
        Object.assign(actualOpenEvents, {
            mouseenter: false,
            focus: false,
            click: false,
            dblclick: false,
            mousedown: false,
        });
        Object.assign(actualCloseEvents, {
            mouseleave: false,
            blur: false,
            click: false,
            dblclick: false,
            mouseup: false,
        });
        Object.assign(actualGlobalCloseEvents, {
            escape: false,
            scroll: false,
            resize: false,
            clickOutsideAnchor: false,
        });
    }
    /**
     * useLayoutEffect runs before useEffect,
     * but should be used carefully because of caveats
     * https://beta.reactjs.org/reference/react/useLayoutEffect#caveats
     */
    useIsomorphicLayoutEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const handleShow = (value) => {
        if (!mounted.current) {
            return;
        }
        if (value) {
            setRendered(true);
        }
        /**
         * wait for the component to render and calculate position
         * before actually showing
         */
        setTimeout(() => {
            if (!mounted.current) {
                return;
            }
            setIsOpen === null || setIsOpen === void 0 ? void 0 : setIsOpen(value);
            if (isOpen === undefined) {
                setShow(value);
            }
        }, 10);
    };
    /**
     * this replicates the effect from `handleShow()`
     * when `isOpen` is changed from outside
     */
    useEffect(() => {
        if (isOpen === undefined) {
            return () => null;
        }
        if (isOpen) {
            setRendered(true);
        }
        const timeout = setTimeout(() => {
            setShow(isOpen);
        }, 10);
        return () => {
            clearTimeout(timeout);
        };
    }, [isOpen]);
    useEffect(() => {
        if (show === wasShowing.current) {
            return;
        }
        if (missedTransitionTimerRef.current) {
            clearTimeout(missedTransitionTimerRef.current);
        }
        wasShowing.current = show;
        if (show) {
            afterShow === null || afterShow === void 0 ? void 0 : afterShow();
        }
        else {
            /**
             * see `onTransitionEnd` on tooltip wrapper
             */
            const style = getComputedStyle(document.body);
            const transitionShowDelay = cssTimeToMs(style.getPropertyValue('--rt-transition-show-delay'));
            missedTransitionTimerRef.current = setTimeout(() => {
                /**
                 * if the tooltip switches from `show === true` to `show === false` too fast
                 * the transition never runs, so `onTransitionEnd` callback never gets fired
                 */
                setRendered(false);
                setImperativeOptions(null);
                afterHide === null || afterHide === void 0 ? void 0 : afterHide();
                // +25ms just to make sure `onTransitionEnd` (if it gets fired) has time to run
            }, transitionShowDelay + 25);
        }
    }, [show]);
    const handleComputedPosition = (newComputedPosition) => {
        setComputedPosition((oldComputedPosition) => deepEqual(oldComputedPosition, newComputedPosition)
            ? oldComputedPosition
            : newComputedPosition);
    };
    const handleShowTooltipDelayed = (delay = delayShow) => {
        if (tooltipShowDelayTimerRef.current) {
            clearTimeout(tooltipShowDelayTimerRef.current);
        }
        if (rendered) {
            // if the tooltip is already rendered, ignore delay
            handleShow(true);
            return;
        }
        tooltipShowDelayTimerRef.current = setTimeout(() => {
            handleShow(true);
        }, delay);
    };
    const handleHideTooltipDelayed = (delay = delayHide) => {
        if (tooltipHideDelayTimerRef.current) {
            clearTimeout(tooltipHideDelayTimerRef.current);
        }
        tooltipHideDelayTimerRef.current = setTimeout(() => {
            if (hoveringTooltip.current) {
                return;
            }
            handleShow(false);
        }, delay);
    };
    const handleShowTooltip = (event) => {
        var _a;
        if (!event) {
            return;
        }
        const target = ((_a = event.currentTarget) !== null && _a !== void 0 ? _a : event.target);
        if (!(target === null || target === void 0 ? void 0 : target.isConnected)) {
            /**
             * this happens when the target is removed from the DOM
             * at the same time the tooltip gets triggered
             */
            setActiveAnchor(null);
            setProviderActiveAnchor({ current: null });
            return;
        }
        if (delayShow) {
            handleShowTooltipDelayed();
        }
        else {
            handleShow(true);
        }
        setActiveAnchor(target);
        setProviderActiveAnchor({ current: target });
        if (tooltipHideDelayTimerRef.current) {
            clearTimeout(tooltipHideDelayTimerRef.current);
        }
    };
    const handleHideTooltip = () => {
        if (clickable) {
            // allow time for the mouse to reach the tooltip, in case there's a gap
            handleHideTooltipDelayed(delayHide || 100);
        }
        else if (delayHide) {
            handleHideTooltipDelayed();
        }
        else {
            handleShow(false);
        }
        if (tooltipShowDelayTimerRef.current) {
            clearTimeout(tooltipShowDelayTimerRef.current);
        }
    };
    const handleTooltipPosition = ({ x, y }) => {
        var _a;
        const virtualElement = {
            getBoundingClientRect() {
                return {
                    x,
                    y,
                    width: 0,
                    height: 0,
                    top: y,
                    left: x,
                    right: x,
                    bottom: y,
                };
            },
        };
        computeTooltipPosition({
            place: (_a = imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.place) !== null && _a !== void 0 ? _a : place,
            offset,
            elementReference: virtualElement,
            tooltipReference: tooltipRef.current,
            tooltipArrowReference: tooltipArrowRef.current,
            strategy: positionStrategy,
            middlewares,
            border,
        }).then((computedStylesData) => {
            handleComputedPosition(computedStylesData);
        });
    };
    const handlePointerMove = (event) => {
        if (!event) {
            return;
        }
        const mouseEvent = event;
        const mousePosition = {
            x: mouseEvent.clientX,
            y: mouseEvent.clientY,
        };
        handleTooltipPosition(mousePosition);
        lastFloatPosition.current = mousePosition;
    };
    const handleClickOutsideAnchors = (event) => {
        var _a;
        if (!show) {
            return;
        }
        const target = event.target;
        if (!target.isConnected) {
            return;
        }
        if ((_a = tooltipRef.current) === null || _a === void 0 ? void 0 : _a.contains(target)) {
            return;
        }
        const anchorById = document.querySelector(`[id='${anchorId}']`);
        const anchors = [anchorById, ...anchorsBySelect];
        if (anchors.some((anchor) => anchor === null || anchor === void 0 ? void 0 : anchor.contains(target))) {
            return;
        }
        handleShow(false);
        if (tooltipShowDelayTimerRef.current) {
            clearTimeout(tooltipShowDelayTimerRef.current);
        }
    };
    // debounce handler to prevent call twice when
    // mouse enter and focus events being triggered toggether
    const internalDebouncedHandleShowTooltip = debounce(handleShowTooltip, 50, true);
    const internalDebouncedHandleHideTooltip = debounce(handleHideTooltip, 50, true);
    // If either of the functions is called while the other is still debounced,
    // reset the timeout. Otherwise if there is a sub-50ms (leave A, enter B, leave B)
    // sequence of events, the tooltip will stay open because the hide debounce
    // from leave A prevented the leave B event from calling it, leaving the
    // tooltip visible.
    const debouncedHandleShowTooltip = (e) => {
        internalDebouncedHandleHideTooltip.cancel();
        internalDebouncedHandleShowTooltip(e);
    };
    const debouncedHandleHideTooltip = () => {
        internalDebouncedHandleShowTooltip.cancel();
        internalDebouncedHandleHideTooltip();
    };
    const updateTooltipPosition = useCallback(() => {
        var _a, _b;
        const actualPosition = (_a = imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.position) !== null && _a !== void 0 ? _a : position;
        if (actualPosition) {
            // if `position` is set, override regular and `float` positioning
            handleTooltipPosition(actualPosition);
            return;
        }
        if (float) {
            if (lastFloatPosition.current) {
                /*
                  Without this, changes to `content`, `place`, `offset`, ..., will only
                  trigger a position calculation after a `mousemove` event.
        
                  To see why this matters, comment this line, run `yarn dev` and click the
                  "Hover me!" anchor.
                */
                handleTooltipPosition(lastFloatPosition.current);
            }
            // if `float` is set, override regular positioning
            return;
        }
        if (!(activeAnchor === null || activeAnchor === void 0 ? void 0 : activeAnchor.isConnected)) {
            return;
        }
        computeTooltipPosition({
            place: (_b = imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.place) !== null && _b !== void 0 ? _b : place,
            offset,
            elementReference: activeAnchor,
            tooltipReference: tooltipRef.current,
            tooltipArrowReference: tooltipArrowRef.current,
            strategy: positionStrategy,
            middlewares,
            border,
        }).then((computedStylesData) => {
            if (!mounted.current) {
                // invalidate computed positions after remount
                return;
            }
            handleComputedPosition(computedStylesData);
        });
    }, [
        show,
        activeAnchor,
        content,
        externalStyles,
        place,
        imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.place,
        offset,
        positionStrategy,
        position,
        imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.position,
        float,
    ]);
    useEffect(() => {
        var _a, _b;
        const elementRefs = new Set(anchorRefs);
        anchorsBySelect.forEach((anchor) => {
            elementRefs.add({ current: anchor });
        });
        const anchorById = document.querySelector(`[id='${anchorId}']`);
        if (anchorById) {
            elementRefs.add({ current: anchorById });
        }
        const handleScrollResize = () => {
            handleShow(false);
        };
        const anchorScrollParent = getScrollParent(activeAnchor);
        const tooltipScrollParent = getScrollParent(tooltipRef.current);
        if (actualGlobalCloseEvents.scroll) {
            window.addEventListener('scroll', handleScrollResize);
            anchorScrollParent === null || anchorScrollParent === void 0 ? void 0 : anchorScrollParent.addEventListener('scroll', handleScrollResize);
            tooltipScrollParent === null || tooltipScrollParent === void 0 ? void 0 : tooltipScrollParent.addEventListener('scroll', handleScrollResize);
        }
        let updateTooltipCleanup = null;
        if (actualGlobalCloseEvents.resize) {
            window.addEventListener('resize', handleScrollResize);
        }
        else if (activeAnchor && tooltipRef.current) {
            updateTooltipCleanup = autoUpdate(activeAnchor, tooltipRef.current, updateTooltipPosition, {
                ancestorResize: true,
                elementResize: true,
                layoutShift: true,
            });
        }
        const handleEsc = (event) => {
            if (event.key !== 'Escape') {
                return;
            }
            handleShow(false);
        };
        if (actualGlobalCloseEvents.escape) {
            window.addEventListener('keydown', handleEsc);
        }
        if (actualGlobalCloseEvents.clickOutsideAnchor) {
            window.addEventListener('click', handleClickOutsideAnchors);
        }
        const enabledEvents = [];
        const handleClickOpenTooltipAnchor = (event) => {
            if (show && (event === null || event === void 0 ? void 0 : event.target) === activeAnchor) {
                /**
                 * ignore clicking the anchor that was used to open the tooltip.
                 * this avoids conflict with the click close event.
                 */
                return;
            }
            handleShowTooltip(event);
        };
        const handleClickCloseTooltipAnchor = (event) => {
            if (!show || (event === null || event === void 0 ? void 0 : event.target) !== activeAnchor) {
                /**
                 * ignore clicking the anchor that was NOT used to open the tooltip.
                 * this avoids closing the tooltip when clicking on a
                 * new anchor with the tooltip already open.
                 */
                return;
            }
            handleHideTooltip();
        };
        const regularEvents = ['mouseenter', 'mouseleave', 'focus', 'blur'];
        const clickEvents = ['click', 'dblclick', 'mousedown', 'mouseup'];
        Object.entries(actualOpenEvents).forEach(([event, enabled]) => {
            if (!enabled) {
                return;
            }
            if (regularEvents.includes(event)) {
                enabledEvents.push({ event, listener: debouncedHandleShowTooltip });
            }
            else if (clickEvents.includes(event)) {
                enabledEvents.push({ event, listener: handleClickOpenTooltipAnchor });
            }
            else ;
        });
        Object.entries(actualCloseEvents).forEach(([event, enabled]) => {
            if (!enabled) {
                return;
            }
            if (regularEvents.includes(event)) {
                enabledEvents.push({ event, listener: debouncedHandleHideTooltip });
            }
            else if (clickEvents.includes(event)) {
                enabledEvents.push({ event, listener: handleClickCloseTooltipAnchor });
            }
            else ;
        });
        if (float) {
            enabledEvents.push({
                event: 'pointermove',
                listener: handlePointerMove,
            });
        }
        const handleMouseEnterTooltip = () => {
            hoveringTooltip.current = true;
        };
        const handleMouseLeaveTooltip = () => {
            hoveringTooltip.current = false;
            handleHideTooltip();
        };
        if (clickable && !hasClickEvent) {
            // used to keep the tooltip open when hovering content.
            // not needed if using click events.
            (_a = tooltipRef.current) === null || _a === void 0 ? void 0 : _a.addEventListener('mouseenter', handleMouseEnterTooltip);
            (_b = tooltipRef.current) === null || _b === void 0 ? void 0 : _b.addEventListener('mouseleave', handleMouseLeaveTooltip);
        }
        enabledEvents.forEach(({ event, listener }) => {
            elementRefs.forEach((ref) => {
                var _a;
                (_a = ref.current) === null || _a === void 0 ? void 0 : _a.addEventListener(event, listener);
            });
        });
        return () => {
            var _a, _b;
            if (actualGlobalCloseEvents.scroll) {
                window.removeEventListener('scroll', handleScrollResize);
                anchorScrollParent === null || anchorScrollParent === void 0 ? void 0 : anchorScrollParent.removeEventListener('scroll', handleScrollResize);
                tooltipScrollParent === null || tooltipScrollParent === void 0 ? void 0 : tooltipScrollParent.removeEventListener('scroll', handleScrollResize);
            }
            if (actualGlobalCloseEvents.resize) {
                window.removeEventListener('resize', handleScrollResize);
            }
            else {
                updateTooltipCleanup === null || updateTooltipCleanup === void 0 ? void 0 : updateTooltipCleanup();
            }
            if (actualGlobalCloseEvents.clickOutsideAnchor) {
                window.removeEventListener('click', handleClickOutsideAnchors);
            }
            if (actualGlobalCloseEvents.escape) {
                window.removeEventListener('keydown', handleEsc);
            }
            if (clickable && !hasClickEvent) {
                (_a = tooltipRef.current) === null || _a === void 0 ? void 0 : _a.removeEventListener('mouseenter', handleMouseEnterTooltip);
                (_b = tooltipRef.current) === null || _b === void 0 ? void 0 : _b.removeEventListener('mouseleave', handleMouseLeaveTooltip);
            }
            enabledEvents.forEach(({ event, listener }) => {
                elementRefs.forEach((ref) => {
                    var _a;
                    (_a = ref.current) === null || _a === void 0 ? void 0 : _a.removeEventListener(event, listener);
                });
            });
        };
        /**
         * rendered is also a dependency to ensure anchor observers are re-registered
         * since `tooltipRef` becomes stale after removing/adding the tooltip to the DOM
         */
    }, [
        activeAnchor,
        updateTooltipPosition,
        rendered,
        anchorRefs,
        anchorsBySelect,
        // the effect uses the `actual*Events` objects, but this should work
        openEvents,
        closeEvents,
        globalCloseEvents,
        shouldOpenOnClick,
        delayShow,
        delayHide,
    ]);
    useEffect(() => {
        var _a, _b;
        let selector = (_b = (_a = imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.anchorSelect) !== null && _a !== void 0 ? _a : anchorSelect) !== null && _b !== void 0 ? _b : '';
        if (!selector && id) {
            selector = `[data-tooltip-id='${id.replace(/'/g, "\\'")}']`;
        }
        const documentObserverCallback = (mutationList) => {
            const newAnchors = [];
            const removedAnchors = [];
            mutationList.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-tooltip-id') {
                    const newId = mutation.target.getAttribute('data-tooltip-id');
                    if (newId === id) {
                        newAnchors.push(mutation.target);
                    }
                    else if (mutation.oldValue === id) {
                        // data-tooltip-id has now been changed, so we need to remove this anchor
                        removedAnchors.push(mutation.target);
                    }
                }
                if (mutation.type !== 'childList') {
                    return;
                }
                if (activeAnchor) {
                    const elements = [...mutation.removedNodes].filter((node) => node.nodeType === 1);
                    if (selector) {
                        try {
                            removedAnchors.push(
                            // the element itself is an anchor
                            ...elements.filter((element) => element.matches(selector)));
                            removedAnchors.push(
                            // the element has children which are anchors
                            ...elements.flatMap((element) => [...element.querySelectorAll(selector)]));
                        }
                        catch (_a) {
                            /**
                             * invalid CSS selector.
                             * already warned on tooltip controller
                             */
                        }
                    }
                    elements.some((node) => {
                        var _a;
                        if ((_a = node === null || node === void 0 ? void 0 : node.contains) === null || _a === void 0 ? void 0 : _a.call(node, activeAnchor)) {
                            setRendered(false);
                            handleShow(false);
                            setActiveAnchor(null);
                            if (tooltipShowDelayTimerRef.current) {
                                clearTimeout(tooltipShowDelayTimerRef.current);
                            }
                            if (tooltipHideDelayTimerRef.current) {
                                clearTimeout(tooltipHideDelayTimerRef.current);
                            }
                            return true;
                        }
                        return false;
                    });
                }
                if (!selector) {
                    return;
                }
                try {
                    const elements = [...mutation.addedNodes].filter((node) => node.nodeType === 1);
                    newAnchors.push(
                    // the element itself is an anchor
                    ...elements.filter((element) => element.matches(selector)));
                    newAnchors.push(
                    // the element has children which are anchors
                    ...elements.flatMap((element) => [...element.querySelectorAll(selector)]));
                }
                catch (_b) {
                    /**
                     * invalid CSS selector.
                     * already warned on tooltip controller
                     */
                }
            });
            if (newAnchors.length || removedAnchors.length) {
                setAnchorsBySelect((anchors) => [
                    ...anchors.filter((anchor) => !removedAnchors.includes(anchor)),
                    ...newAnchors,
                ]);
            }
        };
        const documentObserver = new MutationObserver(documentObserverCallback);
        // watch for anchor being removed from the DOM
        documentObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-tooltip-id'],
            // to track the prev value if we need to remove anchor when data-tooltip-id gets changed
            attributeOldValue: true,
        });
        return () => {
            documentObserver.disconnect();
        };
    }, [id, anchorSelect, imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.anchorSelect, activeAnchor]);
    useEffect(() => {
        updateTooltipPosition();
    }, [updateTooltipPosition]);
    useEffect(() => {
        if (!(contentWrapperRef === null || contentWrapperRef === void 0 ? void 0 : contentWrapperRef.current)) {
            return () => null;
        }
        const contentObserver = new ResizeObserver(() => {
            setTimeout(() => updateTooltipPosition());
        });
        contentObserver.observe(contentWrapperRef.current);
        return () => {
            contentObserver.disconnect();
        };
    }, [content, contentWrapperRef === null || contentWrapperRef === void 0 ? void 0 : contentWrapperRef.current]);
    useEffect(() => {
        var _a;
        const anchorById = document.querySelector(`[id='${anchorId}']`);
        const anchors = [...anchorsBySelect, anchorById];
        if (!activeAnchor || !anchors.includes(activeAnchor)) {
            /**
             * if there is no active anchor,
             * or if the current active anchor is not amongst the allowed ones,
             * reset it
             */
            setActiveAnchor((_a = anchorsBySelect[0]) !== null && _a !== void 0 ? _a : anchorById);
        }
    }, [anchorId, anchorsBySelect, activeAnchor]);
    useEffect(() => {
        if (defaultIsOpen) {
            handleShow(true);
        }
        return () => {
            if (tooltipShowDelayTimerRef.current) {
                clearTimeout(tooltipShowDelayTimerRef.current);
            }
            if (tooltipHideDelayTimerRef.current) {
                clearTimeout(tooltipHideDelayTimerRef.current);
            }
        };
    }, []);
    useEffect(() => {
        var _a;
        let selector = (_a = imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.anchorSelect) !== null && _a !== void 0 ? _a : anchorSelect;
        if (!selector && id) {
            selector = `[data-tooltip-id='${id.replace(/'/g, "\\'")}']`;
        }
        if (!selector) {
            return;
        }
        try {
            const anchors = Array.from(document.querySelectorAll(selector));
            setAnchorsBySelect(anchors);
        }
        catch (_b) {
            // warning was already issued in the controller
            setAnchorsBySelect([]);
        }
    }, [id, anchorSelect, imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.anchorSelect]);
    useEffect(() => {
        if (tooltipShowDelayTimerRef.current) {
            clearTimeout(tooltipShowDelayTimerRef.current);
            handleShowTooltipDelayed(delayShow);
        }
    }, [delayShow]);
    const actualContent = (_a = imperativeOptions === null || imperativeOptions === void 0 ? void 0 : imperativeOptions.content) !== null && _a !== void 0 ? _a : content;
    const canShow = show && Object.keys(computedPosition.tooltipStyles).length > 0;
    useImperativeHandle(forwardRef, () => ({
        open: (options) => {
            if (options === null || options === void 0 ? void 0 : options.anchorSelect) {
                try {
                    document.querySelector(options.anchorSelect);
                }
                catch (_a) {
                    {
                        // eslint-disable-next-line no-console
                        console.warn(`[react-tooltip] "${options.anchorSelect}" is not a valid CSS selector`);
                    }
                    return;
                }
            }
            setImperativeOptions(options !== null && options !== void 0 ? options : null);
            if (options === null || options === void 0 ? void 0 : options.delay) {
                handleShowTooltipDelayed(options.delay);
            }
            else {
                handleShow(true);
            }
        },
        close: (options) => {
            if (options === null || options === void 0 ? void 0 : options.delay) {
                handleHideTooltipDelayed(options.delay);
            }
            else {
                handleShow(false);
            }
        },
        activeAnchor,
        place: computedPosition.place,
        isOpen: Boolean(rendered && !hidden && actualContent && canShow),
    }));
    return rendered && !hidden && actualContent ? (React.createElement(WrapperElement, { id: id, role: role, className: classNames('react-tooltip', coreStyles['tooltip'], styles['tooltip'], styles[variant], className, `react-tooltip__place-${computedPosition.place}`, coreStyles[canShow ? 'show' : 'closing'], canShow ? 'react-tooltip__show' : 'react-tooltip__closing', positionStrategy === 'fixed' && coreStyles['fixed'], clickable && coreStyles['clickable']), onTransitionEnd: (event) => {
            if (missedTransitionTimerRef.current) {
                clearTimeout(missedTransitionTimerRef.current);
            }
            if (show || event.propertyName !== 'opacity') {
                return;
            }
            setRendered(false);
            setImperativeOptions(null);
            afterHide === null || afterHide === void 0 ? void 0 : afterHide();
        }, style: {
            ...externalStyles,
            ...computedPosition.tooltipStyles,
            opacity: opacity !== undefined && canShow ? opacity : undefined,
        }, ref: tooltipRef },
        actualContent,
        React.createElement(WrapperElement, { className: classNames('react-tooltip-arrow', coreStyles['arrow'], styles['arrow'], classNameArrow, noArrow && coreStyles['noArrow']), style: {
                ...computedPosition.tooltipArrowStyles,
                background: arrowColor
                    ? `linear-gradient(to right bottom, transparent 50%, ${arrowColor} 50%)`
                    : undefined,
            }, ref: tooltipArrowRef }))) : null;
};

/* eslint-disable react/no-danger */
const TooltipContent = ({ content }) => {
    return React.createElement("span", { dangerouslySetInnerHTML: { __html: content } });
};

const TooltipController = React.forwardRef(({ id, anchorId, anchorSelect, content, html, render, className, classNameArrow, variant = 'dark', place = 'top', offset = 10, wrapper = 'div', children = null, events = ['hover'], openOnClick = false, positionStrategy = 'absolute', middlewares, delayShow = 0, delayHide = 0, float = false, hidden = false, noArrow = false, clickable = false, closeOnEsc = false, closeOnScroll = false, closeOnResize = false, openEvents, closeEvents, globalCloseEvents, imperativeModeOnly = false, style, position, isOpen, defaultIsOpen = false, disableStyleInjection = false, border, opacity, arrowColor, setIsOpen, afterShow, afterHide, role = 'tooltip', }, ref) => {
    const [tooltipContent, setTooltipContent] = useState(content);
    const [tooltipHtml, setTooltipHtml] = useState(html);
    const [tooltipPlace, setTooltipPlace] = useState(place);
    const [tooltipVariant, setTooltipVariant] = useState(variant);
    const [tooltipOffset, setTooltipOffset] = useState(offset);
    const [tooltipDelayShow, setTooltipDelayShow] = useState(delayShow);
    const [tooltipDelayHide, setTooltipDelayHide] = useState(delayHide);
    const [tooltipFloat, setTooltipFloat] = useState(float);
    const [tooltipHidden, setTooltipHidden] = useState(hidden);
    const [tooltipWrapper, setTooltipWrapper] = useState(wrapper);
    const [tooltipEvents, setTooltipEvents] = useState(events);
    const [tooltipPositionStrategy, setTooltipPositionStrategy] = useState(positionStrategy);
    const [tooltipClassName, setTooltipClassName] = useState(null);
    const [activeAnchor, setActiveAnchor] = useState(null);
    const styleInjectionRef = useRef(disableStyleInjection);
    /**
     * @todo Remove this in a future version (provider/wrapper method is deprecated)
     */
    const { anchorRefs, activeAnchor: providerActiveAnchor } = useTooltip(id);
    const getDataAttributesFromAnchorElement = (elementReference) => {
        const dataAttributes = elementReference === null || elementReference === void 0 ? void 0 : elementReference.getAttributeNames().reduce((acc, name) => {
            var _a;
            if (name.startsWith('data-tooltip-')) {
                const parsedAttribute = name.replace(/^data-tooltip-/, '');
                acc[parsedAttribute] = (_a = elementReference === null || elementReference === void 0 ? void 0 : elementReference.getAttribute(name)) !== null && _a !== void 0 ? _a : null;
            }
            return acc;
        }, {});
        return dataAttributes;
    };
    const applyAllDataAttributesFromAnchorElement = (dataAttributes) => {
        const handleDataAttributes = {
            place: (value) => {
                var _a;
                setTooltipPlace((_a = value) !== null && _a !== void 0 ? _a : place);
            },
            content: (value) => {
                setTooltipContent(value !== null && value !== void 0 ? value : content);
            },
            html: (value) => {
                setTooltipHtml(value !== null && value !== void 0 ? value : html);
            },
            variant: (value) => {
                var _a;
                setTooltipVariant((_a = value) !== null && _a !== void 0 ? _a : variant);
            },
            offset: (value) => {
                setTooltipOffset(value === null ? offset : Number(value));
            },
            wrapper: (value) => {
                var _a;
                setTooltipWrapper((_a = value) !== null && _a !== void 0 ? _a : wrapper);
            },
            events: (value) => {
                const parsed = value === null || value === void 0 ? void 0 : value.split(' ');
                setTooltipEvents(parsed !== null && parsed !== void 0 ? parsed : events);
            },
            'position-strategy': (value) => {
                var _a;
                setTooltipPositionStrategy((_a = value) !== null && _a !== void 0 ? _a : positionStrategy);
            },
            'delay-show': (value) => {
                setTooltipDelayShow(value === null ? delayShow : Number(value));
            },
            'delay-hide': (value) => {
                setTooltipDelayHide(value === null ? delayHide : Number(value));
            },
            float: (value) => {
                setTooltipFloat(value === null ? float : value === 'true');
            },
            hidden: (value) => {
                setTooltipHidden(value === null ? hidden : value === 'true');
            },
            'class-name': (value) => {
                setTooltipClassName(value);
            },
        };
        // reset unset data attributes to default values
        // without this, data attributes from the last active anchor will still be used
        Object.values(handleDataAttributes).forEach((handler) => handler(null));
        Object.entries(dataAttributes).forEach(([key, value]) => {
            var _a;
            (_a = handleDataAttributes[key]) === null || _a === void 0 ? void 0 : _a.call(handleDataAttributes, value);
        });
    };
    useEffect(() => {
        setTooltipContent(content);
    }, [content]);
    useEffect(() => {
        setTooltipHtml(html);
    }, [html]);
    useEffect(() => {
        setTooltipPlace(place);
    }, [place]);
    useEffect(() => {
        setTooltipVariant(variant);
    }, [variant]);
    useEffect(() => {
        setTooltipOffset(offset);
    }, [offset]);
    useEffect(() => {
        setTooltipDelayShow(delayShow);
    }, [delayShow]);
    useEffect(() => {
        setTooltipDelayHide(delayHide);
    }, [delayHide]);
    useEffect(() => {
        setTooltipFloat(float);
    }, [float]);
    useEffect(() => {
        setTooltipHidden(hidden);
    }, [hidden]);
    useEffect(() => {
        setTooltipPositionStrategy(positionStrategy);
    }, [positionStrategy]);
    useEffect(() => {
        if (styleInjectionRef.current === disableStyleInjection) {
            return;
        }
        /* c8 ignore start */
        {
            // eslint-disable-next-line no-console
            console.warn('[react-tooltip] Do not change `disableStyleInjection` dynamically.');
        }
        /* c8 ignore end */
    }, [disableStyleInjection]);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('react-tooltip-inject-styles', {
                detail: {
                    disableCore: disableStyleInjection === 'core',
                    disableBase: disableStyleInjection,
                },
            }));
        }
    }, []);
    useEffect(() => {
        var _a;
        const elementRefs = new Set(anchorRefs);
        let selector = anchorSelect;
        if (!selector && id) {
            selector = `[data-tooltip-id='${id.replace(/'/g, "\\'")}']`;
        }
        if (selector) {
            try {
                const anchorsBySelect = document.querySelectorAll(selector);
                anchorsBySelect.forEach((anchor) => {
                    elementRefs.add({ current: anchor });
                });
            }
            catch (_b) {
                /* c8 ignore start */
                {
                    // eslint-disable-next-line no-console
                    console.warn(`[react-tooltip] "${selector}" is not a valid CSS selector`);
                }
                /* c8 ignore end */
            }
        }
        const anchorById = document.querySelector(`[id='${anchorId}']`);
        if (anchorById) {
            elementRefs.add({ current: anchorById });
        }
        if (!elementRefs.size) {
            return () => null;
        }
        const anchorElement = (_a = activeAnchor !== null && activeAnchor !== void 0 ? activeAnchor : anchorById) !== null && _a !== void 0 ? _a : providerActiveAnchor.current;
        const observerCallback = (mutationList) => {
            mutationList.forEach((mutation) => {
                var _a;
                if (!anchorElement ||
                    mutation.type !== 'attributes' ||
                    !((_a = mutation.attributeName) === null || _a === void 0 ? void 0 : _a.startsWith('data-tooltip-'))) {
                    return;
                }
                // make sure to get all set attributes, since all unset attributes are reset
                const dataAttributes = getDataAttributesFromAnchorElement(anchorElement);
                applyAllDataAttributesFromAnchorElement(dataAttributes);
            });
        };
        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(observerCallback);
        // do not check for subtree and childrens, we only want to know attribute changes
        // to stay watching `data-attributes-*` from anchor element
        const observerConfig = { attributes: true, childList: false, subtree: false };
        if (anchorElement) {
            const dataAttributes = getDataAttributesFromAnchorElement(anchorElement);
            applyAllDataAttributesFromAnchorElement(dataAttributes);
            // Start observing the target node for configured mutations
            observer.observe(anchorElement, observerConfig);
        }
        return () => {
            // Remove the observer when the tooltip is destroyed
            observer.disconnect();
        };
    }, [anchorRefs, providerActiveAnchor, activeAnchor, anchorId, anchorSelect]);
    useEffect(() => {
        /* c8 ignore end */
        if (style === null || style === void 0 ? void 0 : style.border) {
            // eslint-disable-next-line no-console
            console.warn('[react-tooltip] Do not set `style.border`. Use `border` prop instead.');
        }
        if (border && !cssSupports('border', `${border}`)) {
            // eslint-disable-next-line no-console
            console.warn(`[react-tooltip] "${border}" is not a valid \`border\`.`);
        }
        if (style === null || style === void 0 ? void 0 : style.opacity) {
            // eslint-disable-next-line no-console
            console.warn('[react-tooltip] Do not set `style.opacity`. Use `opacity` prop instead.');
        }
        if (opacity && !cssSupports('opacity', `${opacity}`)) {
            // eslint-disable-next-line no-console
            console.warn(`[react-tooltip] "${opacity}" is not a valid \`opacity\`.`);
        }
    }, []);
    /**
     * content priority: children < render or content < html
     * children should be lower priority so that it can be used as the "default" content
     */
    let renderedContent = children;
    const contentWrapperRef = useRef(null);
    if (render) {
        const actualContent = (activeAnchor === null || activeAnchor === void 0 ? void 0 : activeAnchor.getAttribute('data-tooltip-content')) || tooltipContent || null;
        const rendered = render({ content: actualContent, activeAnchor });
        renderedContent = rendered ? (React.createElement("div", { ref: contentWrapperRef, className: "react-tooltip-content-wrapper" }, rendered)) : null;
    }
    else if (tooltipContent) {
        renderedContent = tooltipContent;
    }
    if (tooltipHtml) {
        renderedContent = React.createElement(TooltipContent, { content: tooltipHtml });
    }
    const props = {
        forwardRef: ref,
        id,
        anchorId,
        anchorSelect,
        className: classNames(className, tooltipClassName),
        classNameArrow,
        content: renderedContent,
        contentWrapperRef,
        place: tooltipPlace,
        variant: tooltipVariant,
        offset: tooltipOffset,
        wrapper: tooltipWrapper,
        events: tooltipEvents,
        openOnClick,
        positionStrategy: tooltipPositionStrategy,
        middlewares,
        delayShow: tooltipDelayShow,
        delayHide: tooltipDelayHide,
        float: tooltipFloat,
        hidden: tooltipHidden,
        noArrow,
        clickable,
        closeOnEsc,
        closeOnScroll,
        closeOnResize,
        openEvents,
        closeEvents,
        globalCloseEvents,
        imperativeModeOnly,
        style,
        position,
        isOpen,
        defaultIsOpen,
        border,
        opacity,
        arrowColor,
        setIsOpen,
        afterShow,
        afterHide,
        activeAnchor,
        setActiveAnchor: (anchor) => setActiveAnchor(anchor),
        role,
    };
    return React.createElement(Tooltip, { ...props });
});

// those content will be replaced in build time with the `react-tooltip.css` builded content
const TooltipCoreStyles = `:root {
  --rt-color-white: #fff;
  --rt-color-dark: #222;
  --rt-color-success: #8dc572;
  --rt-color-error: #be6464;
  --rt-color-warning: #f0ad4e;
  --rt-color-info: #337ab7;
  --rt-opacity: 0.9;
  --rt-transition-show-delay: 0.15s;
  --rt-transition-closing-delay: 0.15s;
}

.core-styles-module_tooltip__3vRRp {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  opacity: 0;
  will-change: opacity;
}

.core-styles-module_fixed__pcSol {
  position: fixed;
}

.core-styles-module_arrow__cvMwQ {
  position: absolute;
  background: inherit;
}

.core-styles-module_noArrow__xock6 {
  display: none;
}

.core-styles-module_clickable__ZuTTB {
  pointer-events: auto;
}

.core-styles-module_show__Nt9eE {
  opacity: var(--rt-opacity);
  transition: opacity var(--rt-transition-show-delay) ease-out;
}

.core-styles-module_closing__sGnxF {
  opacity: 0;
  transition: opacity var(--rt-transition-closing-delay) ease-in;
}

`;
const TooltipStyles = `

.styles-module_tooltip__mnnfp {
  padding: 8px 16px;
  border-radius: 3px;
  font-size: 90%;
  width: max-content;
}

.styles-module_arrow__K0L3T {
  width: 8px;
  height: 8px;
}

[class*='react-tooltip__place-top'] > .styles-module_arrow__K0L3T {
  transform: rotate(45deg);
}

[class*='react-tooltip__place-right'] > .styles-module_arrow__K0L3T {
  transform: rotate(135deg);
}

[class*='react-tooltip__place-bottom'] > .styles-module_arrow__K0L3T {
  transform: rotate(225deg);
}

[class*='react-tooltip__place-left'] > .styles-module_arrow__K0L3T {
  transform: rotate(315deg);
}

/** Types variant **/
.styles-module_dark__xNqje {
  background: var(--rt-color-dark);
  color: var(--rt-color-white);
}

.styles-module_light__Z6W-X {
  background-color: var(--rt-color-white);
  color: var(--rt-color-dark);
}

.styles-module_success__A2AKt {
  background-color: var(--rt-color-success);
  color: var(--rt-color-white);
}

.styles-module_warning__SCK0X {
  background-color: var(--rt-color-warning);
  color: var(--rt-color-white);
}

.styles-module_error__JvumD {
  background-color: var(--rt-color-error);
  color: var(--rt-color-white);
}

.styles-module_info__BWdHW {
  background-color: var(--rt-color-info);
  color: var(--rt-color-white);
}
`;
if (typeof window !== 'undefined') {
    window.addEventListener('react-tooltip-inject-styles', ((event) => {
        if (!event.detail.disableCore) {
            injectStyle({ css: TooltipCoreStyles, type: 'core' });
        }
        if (!event.detail.disableBase) {
            injectStyle({ css: TooltipStyles, type: 'base' });
        }
    }));
}

export { TooltipController as Tooltip, TooltipProvider, TooltipWrapper, removeStyle };
