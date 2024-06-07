const timeReg = /\[[\d:.]+\]/g;
const metaReg = /\[(.+):(.+)\]/g;

type LyricMeta = Record<string, any>;

interface IOptions {
  musicItem?: IMusic.IMusicItem;
  translation?: string;
}

export interface IParsedLrcItem {
  /** 时间 s */
  time: number;
  /** 歌词 */
  lrc: string;
  /** 位置 */
  index: number;
}

interface ILyricInfo {
  lastIndex: number;
  lrcItems: Array<IParsedLrcItem>;
  meta: LyricMeta;
}

const lyricTypes = ["raw", "translation"] as const;
type ILyricType = (typeof lyricTypes)[number];

/**
 *
 * 1. 歌词和翻译的meta信息应该相同，以原始歌词为准
 *
 */
export default class LyricParser {
  private _musicItem?: IMusic.IMusicItem;

  private meta: LyricMeta;
  private lrcItems: Array<IParsedLrcItem>;
  private transLrcItems: Array<IParsedLrcItem>;

  private lastIndex = 0;
  private transLastIndex = 0;

  public hasTranslation = false;

  get musicItem() {
    return this._musicItem;
  }

  constructor(raw: string, options?: IOptions) {
    // init
    this._musicItem = options?.musicItem;
    let translation = options?.translation;
    if (!raw && translation) {
      raw = translation;
      translation = undefined;
    }

    const { lrcItems, meta } = this.parseLyricImpl(raw);
    this.meta = meta;
    this.lrcItems = lrcItems;

    if (translation) {
      this.hasTranslation = true;
      this.transLrcItems = this.parseLyricImpl(translation).lrcItems;
    }
  }

  getPosition(position: number) {
    const result: Partial<Record<ILyricType, IParsedLrcItem>> = {};

    const lrc = this.getPositionImpl(position, {
      meta: this.meta,
      lrcItems: this.lrcItems,
      searchFromIndex: this.lastIndex,
    });

    if (!lrc) {
      this.lastIndex = 0;
    } else {
      this.lastIndex = lrc.index;
    }

    result.raw = lrc;

    if (this.hasTranslation) {
      const lrc = this.getPositionImpl(position, {
        meta: this.meta,
        lrcItems: this.transLrcItems,
        searchFromIndex: this.transLastIndex,
      });

      if (!lrc) {
        this.transLastIndex = 0;
      } else {
        this.transLastIndex = lrc.index;
      }
      result.translation = lrc;
    }

    return result;
  }

  getLyricItems(type?: ILyricType) {
    if (type === "raw") {
      return this.lrcItems;
    } else {
      return this.transLrcItems;
    }
  }

  getMeta() {
    return this.meta;
  }

  toString(options?: { withTimestamp?: boolean; type?: ILyricType }) {
    const { type = "raw", withTimestamp = true } = options || {};

    const lrcItems =
      (type === "raw" ? this.lrcItems : this.transLrcItems) || [];
    if (withTimestamp) {
      return lrcItems
        .map((item) => `${this.timeToLrctime(item.time)} ${item.lrc}`)
        .join("\r\n");
    } else {
      return lrcItems.map((item) => item.lrc).join("\r\n");
    }
  }

  /** [xx:xx.xx] => x s */
  private parseTime(timeStr: string): number {
    let result = 0;
    const nums = timeStr.slice(1, timeStr.length - 1).split(":");
    for (let i = 0; i < nums.length; ++i) {
      result = result * 60 + +nums[i];
    }
    return result;
  }
  /** x s => [xx:xx.xx] */
  private timeToLrctime(sec: number) {
    const min = Math.floor(sec / 60);
    sec = sec - min * 60;
    const secInt = Math.floor(sec);
    const secFloat = sec - secInt;
    return `[${min.toFixed(0).padStart(2, "0")}:${secInt
      .toString()
      .padStart(2, "0")}.${secFloat.toFixed(2).slice(2)}]`;
  }

  private parseMetaImpl(metaStr: string) {
    if (metaStr === "") {
      return {};
    }
    const metaArr = metaStr.match(metaReg) ?? [];
    const meta: any = {};
    let k, v;
    for (const m of metaArr) {
      k = m.substring(1, m.indexOf(":"));
      v = m.substring(k.length + 2, m.length - 1);
      if (k === "offset") {
        meta[k] = +v / 1000;
      } else {
        meta[k] = v;
      }
    }
    return meta;
  }

  private parseLyricImpl(raw: string) {
    raw = raw.trim();
    const rawLrcItems: Array<IParsedLrcItem> = [];
    const rawLrcs = raw.split(timeReg) ?? [];
    const rawTimes = raw.match(timeReg) ?? [];
    const len = rawTimes.length;

    const meta = this.parseMetaImpl(rawLrcs[0].trim());
    rawLrcs.shift();

    let counter = 0;
    let j, lrc;
    for (let i = 0; i < len; ++i) {
      counter = 0;
      while (rawLrcs[0] === "") {
        ++counter;
        rawLrcs.shift();
      }
      lrc = rawLrcs[0]?.trim?.() ?? "";
      for (j = i; j < i + counter; ++j) {
        rawLrcItems.push({
          time: this.parseTime(rawTimes[j]),
          lrc,
          index: j,
        });
      }
      i += counter;
      if (i < len) {
        rawLrcItems.push({
          time: this.parseTime(rawTimes[i]),
          lrc,
          index: j,
        });
      }
      rawLrcs.shift();
    }
    let lrcItems = rawLrcItems.sort((a, b) => a.time - b.time);
    if (lrcItems.length === 0 && raw.length) {
      lrcItems = raw.split("\n").map((_, index) => ({
        time: 0,
        lrc: _,
        index,
      }));
    }

    return {
      lrcItems,
      meta,
    };
  }

  private getPositionImpl(
    position: number,
    options: {
      meta?: LyricMeta;
      searchFromIndex: number;
      lrcItems: IParsedLrcItem[];
    }
  ) {
    const { meta, lrcItems, searchFromIndex } = options;
    position = position - (meta?.offset ?? 0);
    let index;
    /** 最前面 */
    if (!lrcItems[0] || position < lrcItems[0].time) {
      return null;
    }
    for (index = searchFromIndex; index < lrcItems.length - 1; ++index) {
      if (
        position >= lrcItems[index].time &&
        position < lrcItems[index + 1].time
      ) {
        return lrcItems[index];
      }
    }

    for (index = 0; index < searchFromIndex; ++index) {
      if (
        position >= lrcItems[index].time &&
        position < lrcItems[index + 1].time
      ) {
        return lrcItems[index];
      }
    }

    index = lrcItems.length - 1;
    return lrcItems[index];
  }
}
