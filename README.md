# cjk-explainer

A small desktop/mobile app for reading Chinese, Japanese, and Korean text. Paste or copy in a passage, and it splits the text into sentences you can tap individually for an AI-generated explanation — grammar notes, vocabulary, and readings — powered by DeepSeek.

Built with [Tauri](https://tauri.app/) + [Vue 3](https://vuejs.org/) + TypeScript, so it runs as a lightweight native app on desktop and Android (with iOS possible via Tauri Mobile).

## Features

- **Paste or auto-detect from clipboard** — type/paste text directly, or turn on clipboard monitoring to pick up CJK text you copy from elsewhere.
- **Automatic language detection** — detects Chinese, Japanese, or Korean from the text's script and tags content accordingly (`zh-CN`, `ja-JP`, `ko-KR`).
- **Sentence-by-sentence explanations** — text is split into sentences; tap any sentence containing CJK characters to get an on-demand explanation.
- **AI-powered breakdowns** — explanations are streamed from the DeepSeek API and include a short summary of how the sentence works plus a vocabulary table with readings.
- **Local caching** — explanations are saved to a local SQLite database (via `tauri-plugin-sql`), so re-opening a sentence you've already explained is instant and works offline.
- **Reasoning trace** — if the model returns intermediate "thinking" output, it's shown collapsed under the explanation for transparency.

## Prerequisites

- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform
- A [DeepSeek API key](https://platform.deepseek.com/) (used for generating explanations)

## Getting started

```bash
# install dependencies
pnpm install

# run the app in development mode
pnpm start
# (equivalent to: pnpm tauri dev)
```

On first launch, open **Settings** and paste in your DeepSeek API key — it's stored locally and used to authenticate explanation requests.

### Android

```bash
# equivalent to `pnpm tauri android run` — automatically builds a debug APK and
# runs it with an adb console attached; requires a connected Android device/emulator
pnpm android

# build and install a debug APK without launching it
pnpm android:build:debug
pnpm android:install:debug   # install the debug APK to a connected device
```

## How it works

1. Enter or paste text into the main text area, or enable **Clipboard** monitoring to auto-fill it as you copy CJK text elsewhere.
2. Tap the lightning bolt button to open the explainer view, which splits your text into sentences.
3. Tap the `...` next to any sentence containing Chinese, Japanese, or Korean characters to request an explanation.
4. The app streams a response from DeepSeek explaining how the sentence works, along with a vocabulary table (with readings for Chinese/Japanese), and caches it locally for next time.

## Tech stack

| Layer              | Tooling                                  |
| ------------------ | ---------------------------------------- |
| UI                 | Vue 3, PrimeVue, PrimeIcons              |
| Build              | Vite, vue-tsc, TypeScript                |
| Shell              | Tauri 2 (Rust)                           |
| Storage            | SQLite via `tauri-plugin-sql`            |
| Clipboard          | `tauri-plugin-clipboard-manager`         |
| Networking         | `tauri-plugin-http`                      |
| LLM                | DeepSeek chat-completions API (streamed) |
| Markdown rendering | `markdown-it`                            |

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
