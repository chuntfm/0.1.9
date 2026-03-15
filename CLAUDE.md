# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ChuntFM (chunt15.org) is a static site for a community internet radio station. Python + Jinja2 build system, vanilla JS frontend, deployed to GitHub Pages.

## Build and develop

```bash
make build          # build site to dist/
make serve          # build + local server on :8000
make rebuild        # clean + build
make clean          # remove dist/
make install        # install Python deps via uv
```

Single command: `uv run build.py`

Dependencies: `jinja2`, `pyyaml` (in requirements.txt), managed via `uv`.

## Architecture

### Build pipeline (build.py)

1. Loads `site.yaml` (single config source for everything)
2. Applies env var overrides (`SITE__SECTION__KEY` convention, double underscore = nesting)
3. Fetches Mixcloud archive JSON at build time for pre-rendering
4. Renders Jinja2 templates for each page defined in `site.yaml` `pages` list
5. Renders `style.css` as a Jinja2 template (for asset URL injection)
6. Copies static assets to `dist/`

Pages are defined in `site.yaml`: empty slug = homepage (`index.html`), named slug = `/{slug}/index.html`.

### Config system (site.yaml)

All site configuration lives here: pages, API endpoints, stream URLs, links, theme colors, polling intervals, analytics. Sensitive values (email, base_path, assets_url) are injected via environment variables in CI. The config is serialized to `window.SITE_CONFIG` for client JS (with email stripped).

### Templates

- `base.html` - layout shell (header, player, footer, script loading)
- `pages/*.html` - page content blocks extending base
- `macros.html` - `content_row` (3-column table row) and `utility_row` (full-width row)
- `style.css` - Jinja2-rendered CSS with `{{ assets }}` for CDN/local path switching

### JavaScript (static/js/)

All modules use IIFE pattern, read config from `window.SITE_CONFIG`, use ES5 for compatibility.

- **player.js** - Audio streaming with reconnect logic, channel switching (1=default, 2=jukebox), Media Session API
- **schedule.js** - Polls API for NOW/UP NEXT/PREVIOUS, timezone toggle (UTC/local)
- **archive.js** - Reads pre-rendered data from embedded `<script type="application/json">`, search + tag filtering (AND logic), falls back to API fetch if embedded data missing
- **counter.js** - Day counter since start_date, BPM tap tempo easter egg
- **theme.js** - Dark/light toggle, link carousel, email obfuscation, easter eggs (dark mode triple-toggle, jukebox double-toggle), keyboard shortcuts (1/2 for channels)
- **swup-init.js** - SPA transitions via Swup (CDN), re-inits schedule/archive on navigation

### Pre-rendering strategy

- **Archive**: data fetched at build time, baked into HTML + embedded as JSON. JS hydrates for search/filter. Falls back to runtime fetch if build-time fetch fails.
- **Schedule**: stays JS-only (real-time data, would be stale immediately after build).

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`): triggers on push to main + daily at 00:05 UTC (to refresh archive data). Secrets provide env var overrides for production paths and email.

## Task tracking

See `tasks/todo.md` for current work items and `tasks/lessons.md` for patterns and corrections to follow.
