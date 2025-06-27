import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import "./index.scss";
import Tag from "@/renderer/components/Tag";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import trackPlayer from "@renderer/core/track-player";
import SvgAsset from "@renderer/components/SvgAsset";
import { showModal } from "@renderer/components/Modal";
import { dialogUtil, fsUtil } from "@shared/utils/renderer";
import MusicSheet from "@/renderer/core/music-sheet";
import { toast } from "react-toastify";

interface IProps {
  musicSheet: IMusic.IMusicSheetItem;
  musicList: IMusic.IMusicItem[];
  hidePlatform?: boolean;
}

export default function Header(props: IProps) {
  const { musicSheet, hidePlatform } = props;
  const containerRef = useRef<HTMLDivElement>();
  const { t } = useTranslation();
  const [isHovering, setIsHovering] = useState(false);

  const handleChangeCover = async () => {
    try {
      console.log("开始更换封面，歌单ID:", musicSheet?.id);
      console.log("歌单信息:", musicSheet);

      // 检查歌单是否存在
      if (!musicSheet?.id) {
        throw new Error("歌单ID无效");
      }

      // 检查歌单是否在歌单列表中
      const allSheets = MusicSheet.frontend.getAllSheets();
      const targetSheet = allSheets.find(
        (sheet: IMusic.IDBMusicSheetItem) => sheet.id === musicSheet.id
      );
      if (!targetSheet) {
        throw new Error(`找不到ID为 ${musicSheet.id} 的歌单`);
      }
      console.log("找到目标歌单:", targetSheet);

      const result = await dialogUtil.showOpenDialog({
        title: t("media.change_album_cover"),
        filters: [
          {
            name: t("media.image_files"),
            extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"],
          },
        ],
        properties: ["openFile"],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        console.log("选择的文件路径:", filePath);

        // 检查文件是否存在
        const fileExists = await fsUtil.isFile(filePath);
        if (!fileExists) {
          throw new Error("选择的文件不存在");
        }

        // 读取文件并转换为base64
        console.log("开始读取文件...");

        // 使用FileReader API，这是在浏览器环境中处理文件的标准方式
        const file = new File(
          [await fsUtil.readFile(filePath)],
          filePath.split("/").pop() || "image"
        );

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // 移除data:image/...;base64,前缀，只保留base64数据
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error("文件读取失败"));
          reader.readAsDataURL(file);
        });

        console.log("Base64转换成功，长度:", base64Data.length);

        // 根据文件扩展名确定MIME类型
        const ext = filePath.toLowerCase().split(".").pop();
        let mimeType = "image/jpeg"; // 默认
        if (ext === "png") {
          mimeType = "image/png";
        } else if (ext === "gif") {
          mimeType = "image/gif";
        } else if (ext === "bmp") {
          mimeType = "image/bmp";
        } else if (ext === "webp") {
          mimeType = "image/webp";
        }

        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        console.log("数据URL创建成功，MIME类型:", mimeType);

        // 更新歌单封面
        console.log("开始更新歌单封面...");
        await MusicSheet.frontend.updateSheet(musicSheet.id, {
          artwork: dataUrl,
        });
        console.log("歌单封面更新成功");

        toast.success(t("media.cover_updated_successfully"));
      } else {
        console.log("用户取消了文件选择");
      }
    } catch (error) {
      console.error("更换封面失败:", error);
      console.error("错误详情:", {
        message: error.message,
        stack: error.stack,
        musicSheetId: musicSheet?.id,
        musicSheetPlatform: musicSheet?.platform,
      });

      // 显示更详细的错误信息
      const errorMessage = error.message || "未知错误";
      toast.error(`${t("media.failed_to_update_cover")}: ${errorMessage}`);
    }
  };

  return (
    <div className="music-sheetlike-view--header-container" ref={containerRef}>
      <div
        className="album-cover-container"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <img
          draggable={false}
          src={musicSheet?.artwork ?? musicSheet?.coverImg ?? albumImg}
          onError={setFallbackAlbum}
          alt={musicSheet?.title}
        ></img>

        {isHovering && (
          <div className="cover-edit-overlay" onClick={handleChangeCover}>
            <SvgAsset iconName="pencil-square" size={24} />
            <span>{t("media.change_cover")}</span>
          </div>
        )}
      </div>

      <div className="sheet-info-container">
        <div className="title-container">
          {musicSheet?.platform && !hidePlatform ? (
            <Tag>{musicSheet?.platform}</Tag>
          ) : null}

          <div className="title">
            {musicSheet?.title ?? t("media.unknown_title")}
          </div>
        </div>

        <Condition condition={musicSheet?.description}>
          <div
            className="info-container description-container"
            data-fold="true"
            title={musicSheet?.description}
            onClick={(e) => {
              const dataset = e.currentTarget.dataset;
              dataset.fold = dataset.fold === "true" ? "false" : "true";
            }}
          >
            {t("media.media_description")}： {musicSheet?.description}
          </div>
        </Condition>

        <Condition condition={musicSheet?.createAt || musicSheet?.playCount}>
          <div className="info-container">
            <IfTruthy condition={musicSheet?.playCount}>
              <span>
                {t("media.media_play_count")} {musicSheet?.playCount}
              </span>
            </IfTruthy>

            <IfTruthy condition={musicSheet?.createAt}>
              <span>
                {t("media.media_create_at")}{" "}
                {dayjs(musicSheet?.createAt).format("YYYY-MM-DD")}
              </span>
            </IfTruthy>
          </div>
        </Condition>

        <Condition condition={musicSheet?.artist}>
          <div className="info-container">
            <span>
              {t("media.media_type_artist")} {musicSheet?.artist}
            </span>
          </div>
        </Condition>
      </div>
    </div>
  );
}
