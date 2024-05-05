export default {
  translation: {
    common: {
      cancel: "取消",
      confirm: "确认",
      download: "下载",
      downloading: "下载中",
      downloaded: "已下载",
      remove: "删除",
      delete: "删除",
      default: "默认",
      version_code: "版本号",
      operation: "操作",
      update: "更新",
      uninstall: "卸载",
      install: "安装",
      about: "关于",
      exit: "退出",
      edit: "编辑",
      undo: "撤销",
      redo: "恢复",
      cut: "剪切",
      copy: "复制",
      paste: "粘贴",
      select_all: "全选",
      loading: "加载中",
      create: "创建",
      add: "添加",
      save: "保存",
      clear: "清空",
    },

    media: {
      unknown_title: "未命名",
      unknown_artist: "未知作者",
      unknown_album: "未知专辑",

      default_favorite_sheet_name: "我喜欢",

      playlist: "播放列表",

      media_type_music: "音乐",
      media_type_album: "专辑",
      media_type_artist: "作者",
      media_type_sheet: "歌单",
      media_type_lyric: "歌词",

      media_title: "标题",
      media_platform: "来源",
      media_duration: "时长",
      media_create_at: "创建时间",
      media_play_count: "播放数",
      media_music_count: "歌曲数",
      media_description: "简介",

      music_state_pause: "暂停",
      music_state_play: "播放",
      music_state_play_or_pause: "播放/暂停",
      music_quality_low: "低音质",
      music_quality_standard: "标准音质",
      music_quality_high: "高音质",
      music_quality_super: "超高音质",

      music_repeat_mode: "播放模式",
      music_repeat_mode_loop: "单曲循环",
      music_repeat_mode_queue: "列表循环",
      music_repeat_mode_shuffle: "随机播放",
    },

    plugin: {
      prop_user_variable: "用户变量",
      method_search: "搜索",
      method_import_music_item: "导入单曲",
      method_import_music_sheet: "导入歌单",
      method_get_top_lists: "排行榜",

      info_hint_you_have_no_plugin: "你还没有安装插件",
      info_hint_you_have_no_plugin_with_supported_method:
        "你还没有安装<highlight>支持 {{supportMethod}} </highlight>功能的插件",
      info_hint_install_plugin_before_use: "先去<a>插件管理</a> 安装插件吧~",
    },

    download_page: {
      waiting: "等待中...",
      failed: "下载失败",
    },
    plugin_management_page: {
      plugin_management: "插件管理",
      choose_plugin: "选择插件",
      install: "安装",
      musicfree_plugin: "MusicFree插件",
      install_successfully: "插件安装成功",
      install_failed: "安装失败",
      invalid_plugin: "无效插件",
      install_from_local_file: "从本地文件安装",
      install_from_network: "从网络安装",
      install_plugin_from_network: "从网络安装插件",
      installing: "正在安装",
      info_hint_install_placeholder: "请输入插件源地址(链接以json或js结尾)",
      error_hint_plugin_should_end_with_js_or_json:
        "插件链接需要以json或者js结尾",
      info_hint_install_plugin:
        "插件需要满足 MusicFree 特定的插件协议，具体可在<a>官方网站</a>中查看",
      subscription_setting: "订阅设置",
      update_subscription: "更新订阅",
      update_successfully: "更新成功",
      no_subscription: "当前无订阅",

      uninstall: "卸载",
      uninstall_plugin: "卸载插件",
      confirm_text_uninstall_plugin: "确认卸载插件 {{plugin}} 吗?",
      uninstall_successfully: "已卸载 {{plugin}}",
      uninstall_failed: "卸载失败",

      toast_plugin_is_latest: "插件 {{plugin}} 已更新到最新版本",
      update_failed: "更新失败",

      update: "更新",

      importing_media: "正在导入中",
      placeholder_import_music_item: "输入 {{plugin}} 单曲链接",
      import_failed: "导入失败",
      placeholder_import_music_sheet: "输入 {{plugin}} 歌单链接",
    },
    local_music_page: {
      local_music: "本地音乐",
      auto_scan: "自动扫描",
      search_local_music: "搜索本地音乐",
      list_view: "列表视图",
      artist_view: "作者视图",
      album_view: "专辑视图",
      folder_view: "文件夹视图",
    },

    music_list_context_menu: {
      next_play: "下一首播放",
      add_to_my_sheets: "添加到歌单",
      remove_from_sheet: "从歌单内删除",
      delete_local_download: "删除本地下载",
      reveal_local_music_in_file_explorer: "打开歌曲所在文件夹",
      reveal_local_music_in_file_explorer_fail: "打开失败: ",

      delete_local_downloaded_songs_success: "已删除 {{musicNums}} 首本地歌曲",
      delete_local_downloaded_song_success: "已删除本地歌曲 [{{songName}}]",
    },

    search_result_page: {
      search_result_title: "的搜索结果",
    },

    languages: {
      "zh-CN": "简体中文",
      "en-US": "英语",
    },
    side_bar: {
      toplist: "排行榜",
      recommend_sheets: "热门歌单",
      download_management: "下载管理",
      local_music: "本地音乐",
      plugin_management: "插件管理",

      my_sheets: "我的歌单",
      create_local_sheet: "新建歌单",
      starred_sheets: "我的收藏",

      delete_sheet: "删除歌单",
    },
    app_header: {
      nav_back: "后退",
      nav_forward: "前进",
      search_placeholder: "在这里输入搜索内容",
      search_history: "搜索历史",
      settings: "设置",
      minimize: "最小化",
      exit: "退出",
    },
    music_bar: {
      open_music_detail_page: "打开歌曲详情页",
      close_music_detail_page: "关闭歌曲详情页",
      previous_music: "上一首",
      next_music: "下一首",
      mute: "静音",
      unmute: "恢复音量",
      playback_speed: "倍速播放",
      choose_music_quality: "切换音质",
      only_set_for_current_music: "仅设置当前歌曲",
      desktop_lyric: "桌面歌词",
    },
    music_detail: {
      search_lyric: "搜索歌词",
      no_lyric: "暂无歌词",

      lyric_ctx_download_lyric: "下载歌词",
      lyric_ctx_download_lyric_lrc: "下载歌词 (.lrc)",
      lyric_ctx_download_lyric_txt: "下载歌词 (.txt)",
      lyric_ctx_download_success: "下载成功",
      lyric_ctx_download_fail: "下载失败",
      lyric_ctx_set_font_size: "设置字号",

      link_media_lyric: "关联歌词",
      media_lyric_linked: "已关联歌词: ",
      unlink_media_lyric: "取消关联歌词",
      toast_media_lyric_unlinked: "已取消关联歌词",
    },
    bottom_loading_state: {
        reached_end: "~~~ 到底啦 ~~~",
        loading: "加载中...",
        load_more: "加载更多"
    },
    empty: {
        hint_empty: "什么都没有呀~~~"
    },
    modal: {
      add_to_my_sheets: "添加到歌单",
      total_music_num: "共 {{number}} 首",
      create_local_sheet: "新建歌单",
      create_local_sheet_placeholder: "请输入新建歌单名称",
      exit_confirm: "确认退出?",
      plugin_subscription: "插件订阅",
      subscription_remarks: "备注: ",
      subscription_links: "链接: ",
      subscription_save_success: "已保存订阅地址",
      search_lyric: "搜索歌词",
      search_lyric_result_empty: "搜索结果为空",
      media_lyric_linked: "已关联歌词~",
      media_lyric_link_failed: "关联歌词失败:",
      new_version_found: "发现新版本",
      latest_version: "最新版本: ",
      current_version: "当前版本: ",
      skip_this_version: "跳过此版本",
      scan_local_music: "扫描本地音乐",
      scan_local_music_hint: "将自动扫描勾选的文件夹 (文件增删实时同步)",
      add_folder: "添加文件夹"

    },
    panel: {
      play_list_song_num: "播放列表 ({{number}}首)",
      user_variable: "用户变量",
      user_variable_setting_success: "设置成功~"
    }
  },
};
