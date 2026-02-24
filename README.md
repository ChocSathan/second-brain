# Second Brain

Second Brain is a desktop knowledge app built with **React + Vite + Electron**.
It lets you organize notes by category, edit in Markdown with live visual helpers, and store everything in a local vault folder on your machine.

By ChocSathan and some vibe codding

## Features

- **Desktop-first app** (Electron) with local file-based persistence
- **Categories + notes** management (create, edit, delete)
- **CodeMirror editor** with Markdown support
- **Live preview helpers** in the editor:
	- Checkboxes (`[ ]`, `[x]`) as interactive toggles
	- List bullet enhancement
	- Inline formatting helpers (`**bold**`, `_italic_`, `--strike--`)
	- KaTeX math rendering (`$...$`, `$$...$$`)
- **Vault folder selection** from the app UI
- **Local fallback storage** (`localStorage`) when no vault is configured

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Electron 40
- Tailwind CSS
- CodeMirror 6
- markdown-it + KaTeX

## Prerequisites

- Node.js 18+ (Node 20 LTS recommended)
- npm
- Windows/macOS/Linux for development

## Getting Started

```bash
npm install
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron app window connected to that server

> Use the **Electron window** (not only the browser tab), because vault APIs are exposed through Electron preload.

## Available Scripts

- `npm run dev` — Run Vite + Electron in development
- `npm run electron` — Launch Electron only
- `npm run build` — Build frontend with Vite
- `npm run dist` — Build app and package with electron-builder

## Vault Storage Model

When a vault folder is configured, data is written to the filesystem.

- Vault index file: `second-brain.index.json`
- Legacy fallback index file (read-only migration path): `second-brain.categories.json`
- One folder per category (slug + id)
- One `.md` file per note (slug + id)

Each note markdown file contains frontmatter:

```md
---
id: "..."
title: "..."
createdAt: "..."
updatedAt: "..."
---

Note body...
```

## Data Loading Behavior

1. App tries to load from vault if configured
2. If vault is empty but local cache exists, local data is written into vault
3. If vault is unavailable, app falls back to `localStorage`

## Security Notes

- `contextIsolation` is enabled in Electron BrowserWindow
- Renderer only accesses filesystem through whitelisted IPC APIs exposed by preload:
	- `vault:getFolder`
	- `vault:setFolder`
	- `vault:selectFolder`
	- `vault:readCategories`
	- `vault:writeCategories`

## Project Structure

```text
src/
	components/editor/      # CodeMirror editor + live preview plugins
	pages/                  # Home and Category screens
	services/               # Vault config helpers
	store/                  # Persistence logic
	types/                  # Domain types (Category, Note)
electron/
	main.ts                 # Main process + vault filesystem logic + IPC
	preload.cjs             # Safe API bridge to renderer
```

## Packaging

`electron-builder` config is in `package.json`.
Current target:
- Windows `nsis`

Output directory:
- `dist_electron/`

## Notes

- UI text is currently in French.
- The app is private (`"private": true`) and not configured for npm publishing.
