# MusicFree 精简便携版（0.0.8）

构建于 2026-11-18，对应仓库提交见 `git log`。包含本定制版全部功能：

- 点击播放条空白处定位当前歌曲（自动展开「我的歌单」并滚到目标歌单）
- 侧边栏双击歌单在首页 / 末页之间切换
- 歌词详情、MV、卡拉 OK、可视化、伴奏候选
- 播放界面与右键菜单文案调整（搜索歌曲 / 歌曲信息）

## 使用

1. 克隆仓库后进入 `release/portable/`。
2. 解压 `MusicFree.exe.zip`，把得到的 `MusicFree.exe` 放到本目录（与 `resources/`、`locales/` 同级）。
3. 双击 `MusicFree.exe` 启动。
4. 首次使用请安装插件（见说明书 `docs/musicfree-user-manual.html`，推荐仓库 `acientemple/ElegantMusic`）。

## 为什么 exe 是压缩包

GitHub 拒绝推送超过 100MB 的单文件，而本仓库是 public fork，无法使用 Git LFS 上传。
`MusicFree.exe` 原始大小 156MB，zip 压缩后约 70MB，只需解压一次。

## 便携版说明

- 所有配置、歌单、插件、主题保存在本目录的 `portable/userData/`，不写系统用户目录。
- 升级时只替换程序文件（`MusicFree.exe`、`resources/`、`locales/` 等），**不要删除 `portable/userData/`**。
- 本发布目录不含任何用户数据。

## 精简内容

相对完整打包产物（约 1.3GB）做了以下裁剪，启动验证通过：

| 项目 | 处理 | 节省 |
| --- | --- | --- |
| `resources/app/node_modules` | 只保留 46 个运行时依赖及其传递依赖（白名单），移除 electron、typescript、webpack、sass、@babel 等开发包 | 约 590MB |
| `locales/` | 只保留 en-GB、en-US、zh-CN、zh-TW | 约 28MB |
| 用户数据、缓存、日志 | 不入库 | — |

精简后约 277MB（其中 `MusicFree.exe.zip` 70MB）。
