# MusicFree 在线安装器

`MusicFreeSetup-Online-0.0.8.exe`（约 3MB）是一个**在线安装器 stub**：安装时从本仓库的
GitHub Release 下载完整程序包 `MusicFree-payload.7z`，解压到安装目录。

## 为什么用在线安装器

- 完整程序约 296MB（未压缩），GitHub 提交单文件上限 100MB；离线安装包（约 67MB）虽可提交，
  但每次发版都会往 git 历史里永久追加一个 67MB 的二进制 blob，克隆越来越慢。
- stub 只有 2.27MB，提交进仓库毫无负担；payload 作为 Release 资产（单文件上限 2GB）不占 git 历史。

## 使用

1. 双击 `MusicFreeSetup-Online-0.0.8.exe`。
2. 保持联网，向导会自动下载程序包（约 90MB，走 GitHub CDN；**大陆网络直连失败时请开代理**）。
3. 选择安装方式：管理员安装到 Program Files，或免管理员安装到用户目录。
4. 安装完成后可直接启动 MusicFree。

payload 固定下载地址（写死在 `.iss` 里）：
`https://github.com/acientemple/ElegantMusicFreeDesktop/releases/download/v0.0.8-custom.1/MusicFree-payload.7z`

## 构建 / 发版流程（维护者）

1. **组装 payload 目录**（如 `out\installer-payload\`）：从 `release\portable\` 复制并
   **排除 `portable\` 目录**（安装版不能触发便携重定向，否则 Program Files 下无写权限）、
   排除 `MusicFree.exe.zip` 与 `README.md`；解压 `MusicFree.exe.zip` 取回 `MusicFree.exe` 放到根。
2. **安全裁剪**：`**\*.map`、`node_modules\better-sqlite3\deps\`（C 源码，运行时只用预编译 .node）、
   `node_modules\socket.io\` + `node_modules\engine.io\`（已核实主 bundle 0 处 require）、
   node_modules 内 `test|tests|example|examples|docs` 目录。**不要动** sharp 的双份 libvips（未验证）。
3. **打包**：在 payload 目录内执行
   `..\..\release\installer\7z\7zr.exe a -t7z -m0=lzma2 -mx=9 -mfb=273 -ms=on -mmt=on ..\MusicFree-payload.7z .`
4. **上传 Release**：`gh release create <新tag> out\MusicFree-payload.7z --target master`
   （资产名保持 `MusicFree-payload.7z`，靠 tag 区分版本）。
5. **改 `.iss`**：`PayloadTag`、`MyAppVersion`（`OutputBaseFilename` 自动跟随）。
6. **编译**：`& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" build-online-installer.iss`，
   产物在 `out\installer\`，复制回本目录提交。
7. **AppId 永不更改**：`{{D1286FEF-7F3B-40BA-8881-36005EE2895E}`，升级识别依赖它。

## 内含第三方组件

- `7z\7zr.exe` —— 7-Zip 独立控制台版（LGPL，许可证 `7z\License.txt`），编译进 stub，安装时释放解压 payload。
- `languages\ChineseSimplified.isl` —— Inno Setup 官方仓库的非官方简中翻译（jrsoftware/issrc，tag is-6_7_3）。

## 实测体积与耗时（2026-11-18，v0.0.8-custom.1）

| 项 | 实测 |
| --- | --- |
| payload 目录（裁剪后） | 295.9MB / 4992 文件 |
| `MusicFree-payload.7z`（LZMA2 ultra 固体压缩） | **66.5MB**（压缩率 22.5%） |
| stub 安装器 | **2.27MB** |
| 静默安装全程（含下载 66.5MB） | 约 57 秒 |

payload SHA256：`56221591BE4ED2F7F9517293F8AD191B8BD91D49BA24BA60F25646B6B4F545F3`
（已写死在 stub 的 `DownloadPage.Add` 第三参数，Inno 下载后自动校验，不符即中止安装。）

## 卸载行为

卸载会**删除整个安装目录**：payload 文件由 7zr 解压而来、不在 Inno 的卸载清单里，
由 `.iss` 的 `CurUninstallStepChanged(usPostUninstall)` 兜底整目录删除
（安全护栏：仅当目录内存在 `MusicFree.exe` 时才执行）。
用户数据在 `%APPDATA%\MusicFree`，卸载**保留**、不删除。
