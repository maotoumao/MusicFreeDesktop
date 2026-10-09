---
name: css-naming
description: Enforce CSS class naming conventions (BEM + global SCSS) when writing, reviewing, or modifying component styles. Triggers when creating/editing SCSS files, adding CSS class names in JSX/TSX, or reviewing styling code. Ensures correct BEM syntax, block-level prefixes, state class usage, and adherence to project theming via CSS variables. Does NOT use CSS Modules or Tailwind CSS.
---

# CSS Class Naming Convention

This project uses **BEM global SCSS**. No CSS Modules, no Tailwind.

## BEM Syntax

```
.block__element--modifier
```

- **Block**: `-` joins multi-word (`song-table`, `context-menu`)
- **Element**: `__` (`song-table__header`)
- **Modifier**: `--` for static variants (`btn--primary`, `btn--lg`)

## Block Prefix by Layer

| Layer     | Prefix | Examples                                          |
| --------- | ------ | ------------------------------------------------- |
| Atom      | (none) | `btn`, `badge`, `input`, `avatar`, `progress-bar` |
| Composite | (none) | `search-input`, `select`, `tab-bar`, `nav-item`   |
| Pattern   | (none) | `modal`, `drawer`, `context-menu`, `song-table`   |
| Layout    | `l-`   | `l-app-shell`, `l-sidebar`, `l-topbar`            |
| Page      | `p-`   | `p-search`, `p-setting`, `p-download`             |
| Business  | `b-`   | `b-search-lyric-modal` (optional, semantic ok)    |

## Dynamic State Classes

Use `is-` / `has-` for runtime JS-toggled states (NOT `--modifier`):

```scss
.nav-item {
    &.is-active {
    }
}
.input {
    &.is-focused {
    }
    &.has-error {
    }
}
.song-table__row {
    &.is-playing {
    }
    &.is-selected {
    }
}
```

**Rule**: `--modifier` = static variant decided at render; `is-`/`has-` = dynamic state toggled by JS.

## File Organization

One SCSS file per component, centered on one primary Block:

```
components/Button/index.scss   → .btn { ... }
components/Modal/index.scss    → .modal { ... }
pages/SearchPage/index.scss    → .p-search { ... }
```

Allowed companions in the same file: tightly-coupled sibling root classes (e.g., `modal-backdrop`).

## Prohibited

| Rule                                                                  | Reason                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Hardcoded colors/font-sizes/spacing/border-radius in component styles | Use CSS variables from `global.scss`; hardcode only with comment justification |
| SCSS nesting > 3 levels                                               | BEM is flat; deep nesting = need to split                                      |
| Bare tag selectors (`div`, `span`, `a`) in component styles           | Only in `global.scss` reset or controlled rich-text containers                 |
| Unexplained `!important`                                              | Only for global reset / a11y / third-party overrides, with comment             |
| Global utility class for single-component need                        | Use BEM modifier instead (`scroll-area--hide-scrollbar`)                       |
| Abbreviated class names (`bg`, `fs`, `mt`)                            | Not utility-first; names must be readable                                      |
| `camelCase` / `PascalCase` class names                                | Use kebab-case with BEM separators                                             |
| Single underscore (`btn_icon`)                                        | Use double underscore `__` for elements                                        |
| Missing `--` for modifiers (`btn-primary`)                            | Must be `btn--primary`                                                         |

## Quick Check

```
✅ .btn--primary   .btn__icon   .nav-item.is-active
✅ .l-sidebar__nav   .p-search__results   .scroll-area--hide-scrollbar

❌ .btn-primary   .sidebar-nav   .active   .BtnPrimary   .btn_icon
```
