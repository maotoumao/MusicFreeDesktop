interface Window {
  fs: typeof import("../preload/internal/fs-delegate").default;
  path: typeof import("node:path");
  rimraf: typeof import("rimraf").rimraf;
  utils: typeof import("../preload/internal/utils").default;
}
