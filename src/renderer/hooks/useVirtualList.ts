import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import throttle from "lodash.throttle";

interface IVirtualListProps<T> {
  /** 滚动的容器 */
  getScrollElement?: () => HTMLElement;
  /** 滚动容器的query */
  scrollElementQuery?: string;
  /** 元素高度和列表高度 */
  estimizeItemHeight: number;

  /** 数据 */
  data: T[];
  /** 渲染数目 */
  renderCount?: number;
  /** 虚拟列表失效时的渲染数目 */
  fallbackRenderCount?: number;
  /** 偏移高度 */
  offsetHeight?: number | (() => number);
}

interface IVirtualItem<T> {
  /** 偏移 */
  top: number;
  /** 下标 */
  rowIndex: number;
  /** 数据 */
  dataItem: T;
}

export default function useVirtualList<T>(props: IVirtualListProps<T>) {
  const {
    estimizeItemHeight,
    data,
    renderCount = 40,
    fallbackRenderCount = -1,
    getScrollElement,
    scrollElementQuery,
    offsetHeight = 0,
  } = props;
  const dataRef = useRef(data);
  dataRef.current = data;

  const [virtualItems, setVirtualItems] = useState<IVirtualItem<T>[]>([]);
  const [totalHeight, setTotalHeight] = useState<number>(
    data.length * estimizeItemHeight
  );

  const scrollElementRef = useRef<HTMLElement>();

  const scrollHandler = useCallback(
    throttle(
      () => {
        const scrollTop =
          (scrollElementRef.current?.scrollTop ?? 0) -
          (typeof offsetHeight === "number" ? offsetHeight : offsetHeight());
        const realData = dataRef.current;
        const estimizeStartIndex = Math.floor(scrollTop / estimizeItemHeight);
        const startIndex = Math.max(
          estimizeStartIndex - (estimizeStartIndex % 2 === 1 ? 3 : 2),
          0
        );

        setVirtualItems(
          realData
            .slice(
              startIndex,
              startIndex +
                (scrollElementRef.current
                  ? renderCount
                  : fallbackRenderCount < 0
                  ? realData.length
                  : fallbackRenderCount)
            )
            .map((item, index) => ({
              rowIndex: startIndex + index,
              dataItem: item,
              top: (startIndex + index) * estimizeItemHeight,
            }))
        );
      },
      32,
      {
        trailing: true,
        leading: true,
      }
    ),
    []
  );

  useEffect(() => {
    setTotalHeight(data.length * estimizeItemHeight);
    scrollHandler();
  }, [data]);

  useEffect(() => {
    if (!scrollElementRef.current) {
      scrollElementRef.current = getScrollElement
        ? getScrollElement()
        : document.querySelector(scrollElementQuery);
    }
    if (scrollElementRef.current) {
      scrollElementRef.current.addEventListener("scroll", scrollHandler);
    }

    return () => {
      scrollElementRef.current?.removeEventListener?.("scroll", scrollHandler);
      scrollElementRef.current = null;
    };
  }, []);

  function setScrollElement(scrollElement: HTMLElement) {
    scrollElementRef.current?.removeEventListener("scroll", scrollHandler);
    scrollElementRef.current = scrollElement;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", scrollHandler);
      scrollHandler();
    }
  }

  function scrollToIndex(index: number, behavior?: ScrollBehavior) {
    scrollElementRef.current.scrollTo({
      top:
        (typeof offsetHeight === "number" ? offsetHeight : offsetHeight()) +
        estimizeItemHeight * index,
      behavior,
    });
  }

  return {
    virtualItems,
    totalHeight,
    startTop: virtualItems[0]?.top ?? 0,
    setScrollElement,
    scrollToIndex,
  };
}
