interface Window {
  fs: typeof import("../preload/internal/fs-delegate").default;
  themepack: typeof import("../preload/internal/themepack").default;
  path: typeof import("node:path");
  rimraf: typeof import("rimraf").rimraf;
  utils: typeof import("../preload/internal/utils").default;
  /** 向拓展窗口广播数据 */
  mainPort: typeof import("../preload/internal/main-port").default;
  extPort: typeof import("../preload/internal/ext-port").default;
}
