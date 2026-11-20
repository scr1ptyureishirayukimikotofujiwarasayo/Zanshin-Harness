# Zanshin Harness

Zanshin Harness is a focused, local-first workspace for coding agents. The interface keeps the current run, task queue, system flow, context budget, and safety posture visible without turning the workspace into a command center full of noise.

![Zanshin Harness workspace](public/aestheticharness.png)

## Current build

This repository contains a standalone Electron desktop GUI with cherry-blossom HUD styling, session navigation, Plan/Build mode controls, transcript cards, tool-call disclosure, context usage controls, text limiting, slash commands, and a command palette.

The local runtime and provider adapters described in the project brief are the next layer to connect to this shell.

## Quickstart

Install dependencies once, then launch the native desktop GUI:

```bash
npm install
npm run desktop
```

For live development, use `npm run desktop:dev`. To create a Linux AppImage, run `npm run package`; the result is written to the `release` folder.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Commands

| Command | What it does |
| --- | --- |
| `/ctxlimit 50k` | Set the context budget. |
| `/ctxstatus` | Show current usage and offload stats. |
| `/clearcontext` | Clear the active context window. |
| `/textlimit 120` | Set a word limit for assistant text. |
| `/textlimit on\|off\|toggle` | Toggle the text limiter. |
| `/mode plan\|build` | Switch the active work mode. |
| `/model` | Open the model picker. |

Keyboard shortcuts: `Ctrl/Cmd + K` opens the command palette, `Tab` switches modes, and `Ctrl + Alt + L` toggles the text limiter.

## Design direction

The visual language takes its cues from the included background art: lavender and cherry-pink neon, deep plum contrast, glass panels, small HUD labels, and a restrained falling-petal layer. Reduced-motion preferences are respected.

## Project layout

| Path | Purpose |
| --- | --- |
| `electron/main.cjs` | Native window lifecycle and secure renderer loading. |
| `electron/preload.cjs` | Minimal isolated desktop bridge. |
| `src/App.tsx` | Workspace layout and interaction states. |
| `src/index.css` | Theme, responsive layout, glass HUD styling, and motion. |
| `public/aestheticharness.png` | Background art for the workspace. |

## License

MIT. See [LICENSE](LICENSE).
