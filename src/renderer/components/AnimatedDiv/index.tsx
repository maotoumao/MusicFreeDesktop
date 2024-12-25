import React, { useMemo, useState, useEffect } from "react";



interface IProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  // 展示条件
  showIf?: boolean;
  // 挂载动画
  mountClassName?: string;
  // 卸载动画
  unmountClassName?: string;
  onMountAnimationEnd?: () => void;
  onUnmountAnimationEnd?: () => void;
}

/**
 * 动画div组件
 * @returns
 */
export default function AnimatedDiv(props: IProps) {
  const {
    showIf = true,
    mountClassName,
    unmountClassName,
      onMountAnimationEnd,
      onUnmountAnimationEnd,
    className,
    onAnimationEnd,
  } = props ?? {};

  const [shouldMount, setShouldMount] = useState(false);
  const [animationPlaying, setAnimationPlaying] = useState(false);

  const filteredProps: Record<string, any> = useMemo(() => {
    const res = {
      ...(props ?? {}),
    } as any;
    delete res.showIf;
    delete res.mountClassName;
    delete res.unmountClassName;
    return res;
  }, [props]);

  useEffect(() => {
    if (showIf) {
      setShouldMount(true);
    } else {
      !unmountClassName && setShouldMount(false);
    }
  }, [showIf]);

  return shouldMount ? (
    <div
      {...(filteredProps)}
      className={`${className ?? ""} ${
        showIf ? mountClassName ?? "" : unmountClassName ?? ""
      }`}
      onAnimationEnd={(...args) => {
        onAnimationEnd?.(...args);
        if (!showIf) {
          // 如果showIf是false，表示当前播放的是卸载状态的动画
          setShouldMount(false);
          onUnmountAnimationEnd?.();
        } else {
          setShouldMount(true);
          onMountAnimationEnd?.();
        }
        setAnimationPlaying(prev => !prev);
      }}
    ></div>
  ) : null;
}
