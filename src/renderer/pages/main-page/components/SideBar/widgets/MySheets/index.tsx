import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import SvgAsset from "@/renderer/components/SvgAsset";
import { hideModal, showModal } from "@/renderer/components/Modal";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";
import { useTranslation } from "react-i18next";
import { useSupportedPlugin } from "@shared/plugin-manager/renderer";
import { useMemo } from "react";

type SheetListEntry =
    | {
        type: "sheet";
        sheet: IMusic.IDBMusicSheetItem;
        title: string;
    }
    | {
        type: "group";
        title: string;
        sheets: Array<{
            sheet: IMusic.IDBMusicSheetItem;
            title: string;
        }>;
    };

const groupTitleRegExp = /^(.+?)\s+-\s+(.+)$/;

export default function MySheets() {
    const sheetIdMatch = useMatch(
        `/main/musicsheet/${encodeURIComponent(localPluginName)}/:sheetId`,
    );
    const currentSheetId = sheetIdMatch?.params?.sheetId;
    const musicSheets = MusicSheet.frontend.useAllSheets();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const importablePlugins = useSupportedPlugin("importMusicSheet");

    const groupedMusicSheets = useMemo<SheetListEntry[]>(() => {
        const prefixCount = new Map<string, number>();

        musicSheets.forEach((item) => {
            if (item.id === defaultSheet.id) {
                return;
            }
            const prefix = item.title.match(groupTitleRegExp)?.[1]?.trim();
            if (!prefix) {
                return;
            }
            prefixCount.set(prefix, (prefixCount.get(prefix) ?? 0) + 1);
        });

        const result: SheetListEntry[] = [];
        const insertedGroups = new Set<string>();

        musicSheets.forEach((item) => {
            const matchedTitle = item.title.match(groupTitleRegExp);
            const prefix = matchedTitle?.[1]?.trim();
            const childTitle = matchedTitle?.[2]?.trim();

            if (
                item.id !== defaultSheet.id
                && prefix
                && childTitle
                && (prefixCount.get(prefix) ?? 0) > 1
            ) {
                if (!insertedGroups.has(prefix)) {
                    result.push({
                        type: "group",
                        title: prefix,
                        sheets: musicSheets
                            .filter((sheet) => {
                                const titleMatch = sheet.title.match(groupTitleRegExp);
                                return titleMatch?.[1]?.trim() === prefix;
                            })
                            .map((sheet) => ({
                                sheet,
                                title: sheet.title.match(groupTitleRegExp)?.[2]?.trim() || sheet.title,
                            })),
                    });
                    insertedGroups.add(prefix);
                }
                return;
            }

            result.push({
                type: "sheet",
                sheet: item,
                title: item.id === defaultSheet.id
                    ? t("media.default_favorite_sheet_name")
                    : item.title,
            });
        });

        return result;
    }, [musicSheets, t]);

    function renderSheetItem(
        item: IMusic.IDBMusicSheetItem,
        title: string,
        isGrouped = false,
    ) {
        return (
            <ListItem
                key={item.id}
                className={isGrouped ? "grouped-sheet" : undefined}
                iconName={
                    item.id === defaultSheet.id ? "heart-outline" : "musical-note"
                }
                onClick={() => {
                    if (currentSheetId !== item.id) {
                        navigate(`/main/musicsheet/${encodeURIComponent(localPluginName)}/${encodeURIComponent(item.id)}`);
                    }
                }}
                onContextMenu={(e) => {
                    if (item.id === defaultSheet.id) {
                        return;
                    }
                    showContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        menuItems: [
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
                title={title}
            ></ListItem>
        );
    }

    return (
        <div className="side-bar-container--my-sheets">
            <div className="divider"></div>
            <Disclosure defaultOpen>
                <Disclosure.Button className="title" as="div" role="button">
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
                        title={t("side_bar.create_local_sheet")}
                        onClick={(e) => {
                            e.stopPropagation();
                            showModal("AddNewSheet");
                        }}
                    >
                        <SvgAsset iconName="plus"></SvgAsset>
                    </div>
                </Disclosure.Button>
                <Disclosure.Panel>
                    {groupedMusicSheets.map((entry) => {
                        if (entry.type === "sheet") {
                            return renderSheetItem(entry.sheet, entry.title);
                        }

                        const hasSelectedSheet = entry.sheets.some(
                            ({ sheet }) => sheet.id === currentSheetId,
                        );

                        return (
                            <Disclosure key={entry.title} defaultOpen={hasSelectedSheet}>
                                <Disclosure.Button
                                    className="sheet-group-title"
                                    as="div"
                                    role="button"
                                    data-selected={hasSelectedSheet}
                                >
                                    <SvgAsset iconName="chevron-right"></SvgAsset>
                                    <span>{entry.title}</span>
                                </Disclosure.Button>
                                <Disclosure.Panel>
                                    {entry.sheets.map(({ sheet, title }) => renderSheetItem(sheet, title, true))}
                                </Disclosure.Panel>
                            </Disclosure>
                        );
                    })}
                </Disclosure.Panel>
            </Disclosure>
        </div>
    );
}
