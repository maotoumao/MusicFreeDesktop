import "./index.scss";
import { useEffect, useRef, useState } from "react";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import SvgAsset from "@/renderer/components/SvgAsset";
import { hideModal, showModal } from "@/renderer/components/Modal";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";
import { useTranslation } from "react-i18next";
import { useSupportedPlugin } from "@shared/plugin-manager/renderer";
import { toast } from "react-toastify";
import { dialogUtil, fsUtil } from "@shared/utils/renderer";
import { useLocateTarget } from "@/renderer/core/music-locate";
import {
    buildExportFileName,
    buildSheetBackupJson,
} from "@/renderer/core/music-sheet/common/export-util";


export default function MySheets() {
    const sheetIdMatch = useMatch(
        `/main/musicsheet/${encodeURIComponent(localPluginName)}/:sheetId`,
    );
    const currentSheetId = sheetIdMatch?.params?.sheetId;
    const musicSheets = MusicSheet.frontend.useAllSheets();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // 定位当前歌曲时（底栏空白处 / 播放列表面板），自动展开「我的歌单」
    // 并把目标歌单滚到侧边栏可见范围内
    const locateTarget = useLocateTarget();
    const [disclosureOpen, setDisclosureOpen] = useState(true);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        const targetSheetId = locateTarget?.sheetId;
        if (
            !targetSheetId ||
            !musicSheets.some((item) => item.id === targetSheetId)
        ) {
            return;
        }
        setDisclosureOpen(true);
        // 展开是异步渲染，等面板挂载后再滚；nonce 每次定位都会变
        const timer = window.setTimeout(() => {
            itemRefs.current[targetSheetId]?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }, 100);
        return () => window.clearTimeout(timer);
    }, [locateTarget?.nonce]);

    /**
     * 双击歌单项：在歌单页的顶部（第一页）和底部（最后一页）之间切换。
     * 双击的不是当前歌单时先切过去，新页面本来就在顶部。
     */
    const lastDoubleClickRef = useRef<{
        sheetId: string;
        direction: "top" | "bottom";
    } | null>(null);

    const onSheetDoubleClick = (sheetId: string) => {
        if (currentSheetId !== sheetId) {
            navigate(
                `/main/musicsheet/${encodeURIComponent(
                    localPluginName,
                )}/${encodeURIComponent(sheetId)}`,
            );
            lastDoubleClickRef.current = { sheetId, direction: "top" };
            return;
        }
        const previous = lastDoubleClickRef.current;
        const direction =
            previous?.sheetId === sheetId && previous.direction === "top"
                ? "bottom"
                : "top";
        lastDoubleClickRef.current = { sheetId, direction };
        const container =
            document.querySelector<HTMLElement>("#page-container");
        if (!container) {
            return;
        }
        container.scrollTo({
            top: direction === "top" ? 0 : container.scrollHeight,
            behavior: "smooth",
        });
    };

    const importablePlugins = useSupportedPlugin("importMusicSheet");

    async function writeExportFile(sheets: any[], fileName: string) {
        const result = await dialogUtil.showSaveDialog({
            defaultPath: fileName,
            properties: ["showOverwriteConfirmation", "createDirectory"],
            filters: [
                {
                    name: "MusicFree",
                    extensions: ["json"],
                },
            ],
            title: t("side_bar.export_sheet"),
        });
        if (result.canceled || !result.filePath) {
            return;
        }
        await fsUtil.writeFile(
            result.filePath,
            buildSheetBackupJson(sheets),
            "utf-8",
        );
        toast.success(t("side_bar.export_sheet_success"));
    }

    /**
     * 默认歌单在数据库里的 title 常常是空的（i18n 初始化早于建表），
     * 导出时补上界面上的显示名，免得文件里出现无名歌单。
     */
    function withDisplayTitle(sheets: any[]) {
        return sheets.map((sheet) =>
            sheet?.id === defaultSheet.id && !sheet?.title
                ? { ...sheet, title: t("media.default_favorite_sheet_name") }
                : sheet,
        );
    }

    async function onExportSheet(sheetId: string, title: string) {
        try {
            const detail = await MusicSheet.frontend.getSheetItemDetail(sheetId);
            if (!detail) {
                throw new Error(t("side_bar.export_sheet_not_found"));
            }
            await writeExportFile(
                withDisplayTitle([detail]),
                buildExportFileName(title),
            );
        } catch (e) {
            toast.error(
                t("side_bar.export_sheet_fail", {
                    reason: e?.message ?? "",
                }),
            );
        }
    }

    async function onExportAllSheets() {
        try {
            const allSheets = await MusicSheet.frontend.exportAllSheetDetails();
            if (!allSheets?.length) {
                throw new Error(t("side_bar.export_sheet_not_found"));
            }
            await writeExportFile(
                withDisplayTitle(allSheets),
                buildExportFileName(t("side_bar.my_sheets")),
            );
        } catch (e) {
            toast.error(
                t("side_bar.export_sheet_fail", {
                    reason: e?.message ?? "",
                }),
            );
        }
    }

    return (
        <div className="side-bar-container--my-sheets">
            <div className="divider"></div>
            {/* Headless UI v1 的 Disclosure 不支持受控展开，而定位当前歌曲时
                需要程序化展开，所以这里自己做折叠状态。data-headlessui-state
                保留下来给样式里的箭头旋转用。 */}
            <div
                className="title"
                role="button"
                data-headlessui-state={disclosureOpen ? "open" : undefined}
                onClick={() => setDisclosureOpen((value) => !value)}
            >
                <div className="my-sheets">{t("side_bar.my_sheets")}</div>
                <div
                    role="button"
                    className="option-btn"
                    title={t("plugin.method_import_music_sheet")}
                    onClick={(e) => {
                        e.stopPropagation();
                        showModal("ImportMusicSheet", {
                            plugins: importablePlugins,
                        });
                    }}
                >
                    <SvgAsset iconName="arrow-left-end-on-rectangle"></SvgAsset>
                </div>
                <div
                    role="button"
                    className="option-btn"
                    title={t("side_bar.export_all_sheets")}
                    onClick={(e) => {
                        e.stopPropagation();
                        onExportAllSheets();
                    }}
                >
                    <SvgAsset iconName="array-download-tray"></SvgAsset>
                </div>
                <div
                    role="button"
                    className="option-btn"
                    title={t("side_bar.create_local_sheet")}
                    onClick={(e) => {
                        e.stopPropagation();
                        showModal("AddNewSheet");
                    }}
                >
                    <SvgAsset iconName="plus"></SvgAsset>
                </div>
            </div>
            {disclosureOpen ? (
                <div>
                    {musicSheets.map((item) => (
                        <ListItem
                            key={item.id}
                            ref={(el) => {
                                itemRefs.current[item.id] = el;
                            }}
                            iconName={
                                item.id === defaultSheet.id ? "heart-outline" : "musical-note"
                            }
                            onClick={() => {
                                if (currentSheetId !== item.id) {
                                    navigate(`/main/musicsheet/${encodeURIComponent(localPluginName)}/${encodeURIComponent(item.id)}`);
                                }
                            }}
                            onDoubleClick={() => onSheetDoubleClick(item.id)}
                            onContextMenu={(e) => {
                                showContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    menuItems: [
                                        {
                                            title: t("side_bar.export_sheet"),
                                            icon: "array-download-tray",
                                            onClick() {
                                                onExportSheet(
                                                    item.id,
                                                    item.id === defaultSheet.id
                                                        ? t("media.default_favorite_sheet_name")
                                                        : item.title,
                                                );
                                            },
                                        },
                                        {
                                            title: t("side_bar.rename_sheet"),
                                            icon: "pencil-square",
                                            show: item.id !== defaultSheet.id,
                                            onClick() {
                                                showModal("SimpleInputWithState", {
                                                    placeholder: t(
                                                        "modal.create_local_sheet_placeholder",
                                                    ),
                                                    maxLength: 30,
                                                    title: t("side_bar.rename_sheet"),
                                                    defaultValue: item.title,
                                                    async onOk(text) {
                                                        await MusicSheet.frontend.updateSheet(item.id, {
                                                            title: text,
                                                        });
                                                        hideModal();
                                                    },
                                                });
                                            },
                                        },
                                        {
                                            title: t("side_bar.delete_sheet"),
                                            icon: "trash",
                                            show: item.id !== defaultSheet.id,
                                            onClick() {
                                                MusicSheet.frontend.removeSheet(item.id).then(() => {
                                                    if (currentSheetId === item.id) {
                                                        navigate(
                                                            `/main/musicsheet/${encodeURIComponent(localPluginName)}/${defaultSheet.id}`,
                                                            {
                                                                replace: true,
                                                            },
                                                        );
                                                    }
                                                });
                                            },
                                        },
                                    ],
                                });
                            }}
                            selected={currentSheetId === item.id}
                            title={
                                item.id === defaultSheet.id
                                    ? t("media.default_favorite_sheet_name")
                                    : item.title
                            }
                        ></ListItem>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
