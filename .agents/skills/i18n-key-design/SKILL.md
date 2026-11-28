---
name: i18n-key-design
description: Enforce i18n key naming conventions when adding, modifying, or reviewing i18n keys. Triggers whenever code touches i18n translation files (res/lang/*.json), calls t() or useTranslation(), or adds new translatable strings. Ensures keys follow domain-based namespacing, avoid UI-location-based naming, and maintain strict common namespace boundaries.
---

# i18n Key Design Convention

## Key Structure

```
{namespace}.{descriptive_key}
```

- Format: `snake_case` for both namespace and key
- Depth: 2 levels (`namespace.key`), except `settings` which allows 3 levels (`settings.{section}.{key}`)
- Separator: `.` (dot) for hierarchy

## Namespace Registry

| Namespace     | Scope                                                             |
| ------------- | ----------------------------------------------------------------- |
| `common`      | Context-free atomic words (see strict rules below)                |
| `media`       | Media entity attributes: title, artist, album, duration           |
| `playback`    | Play controls: play, pause, next, previous, repeat modes          |
| `quality`     | Audio quality levels and switching                                |
| `playlist`    | Sheet/playlist operations: create, rename, delete, add song, star |
| `search`      | Search functionality                                              |
| `download`    | Download queue, status, actions                                   |
| `plugin`      | Plugin install, uninstall, update, subscription                   |
| `lyric`       | Lyric display, search, download, link                             |
| `theme`       | Theme install, uninstall, preview, marketplace                    |
| `settings`    | All settings items (3-level: `settings.{section}.{key}`)          |
| `local_music` | Local music scan, import, file operations                         |
| `toplist`     | Charts/rankings                                                   |
| `shortcut`    | Keyboard shortcuts                                                |
| `backup`      | Backup and restore                                                |
| `status`      | Generic loading/empty/end-of-list states                          |
| `app`         | App-level actions: exit, minimize, update, about                  |
| `history`     | Recently played                                                   |
| `migration`   | Data migration                                                    |

New namespaces may be added when a genuinely new domain emerges. Do not create page-level or component-level namespaces (e.g., ~~`music_bar`~~, ~~`side_bar`~~, ~~`modal`~~).

## The `common` Namespace — Strict Boundary

`common` only accepts **atomic words** meeting ALL of these:

1. ≤ 3 Chinese characters (or equivalent short English word)
2. No interpolation variables (`{{...}}`)
3. No domain-specific nouns (歌单, 插件, 歌词, 主题, etc.)
4. Understandable on a standalone button with zero context

```
✅ common.cancel, common.confirm, common.save, common.delete,
   common.add, common.edit, common.open, common.close,
   common.loading, common.search, common.irreversible

❌ common.add_to_favorites     → playlist.add_to_favorites
❌ common.download_failed_retry → download.failed_retry
❌ common.total_song_count      → media.song_count
```

## Decision Flowchart

When adding a new i18n key, follow this sequence:

1. **Is it an atomic word with no domain context?** → `common.*`
2. **Does it contain a domain noun or variable?** → that domain's namespace
3. **Is it a confirmation/warning sentence?** → the domain it confirms (not a generic `dialog` namespace)
4. **Is it a settings label?** → `settings.{section}.*`
5. **None of the above?** → find or create the most specific domain namespace

## Rules

### No namespace echo in key name

```
✅ media.title
❌ media.media_title
```

### No duplicate translations across namespaces

If the exact same translated text (including variables) exists, reuse the single key. Do not create per-page copies.

### Consistent interpolation variable names

| Semantic | Variable      |
| -------- | ------------- |
| Count    | `{{count}}`   |
| Name     | `{{name}}`    |
| Reason   | `{{reason}}`  |
| Version  | `{{version}}` |

### Organize by domain, not UI location

Keys describe **what the text means**, not **where it appears**.

```
✅ playback.next         (domain: playback)
❌ music_bar.next_music  (location: music bar component)

✅ plugin.uninstall_confirm
❌ modal.confirm_uninstall_plugin
```
