import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";

import { mainConfig } from "./config/webpack.main.config";
import { rendererConfig } from "./config/webpack.renderer.config";
import path from "path";

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "fun.upup.musicfree",
    // icon: path.resolve(__dirname, "res/logo"),
    executableName: "MusicFree",
    extraResource: [
      path.resolve(__dirname, 'res'),
      
    ],
  },
  rebuildConfig: {},
  makers: [
    // new MakerSquirrel({
    //   exe: "MusicFree",
    //   setupIcon: path.resolve(__dirname, "resources/logo.ico"),
    //   setupMsi: "MusicFreeInstaller",
    // }),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new WebpackPlugin({
      devContentSecurityPolicy: `default-src * self blob: data: gap: file:; style-src * self 'unsafe-inline' blob: data: gap: file:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap: file:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;`,
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/renderer/document/index.html",
            js: "./src/renderer/document/index.tsx",
            name: "main_window",
            preload: {
              js: "./src/preload/index.ts",
            },
          },
          {
            html: "./src/renderer-lrc/document/index.html",
            js: "./src/renderer-lrc/document/index.tsx",
            name: "lrc_window",
            preload: {
              js: "./src/preload/index.ts",
            },
          },
        ],
      },
    }),
  ],
};

export default config;
