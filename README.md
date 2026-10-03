# Tauri + Vue + TypeScript

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Project structure

Each feature lives in its own file so people can work in parallel without touching the same code.

| Path | Responsibility |
| --- | --- |
| `src/App.vue` | Shows the login page or the navbar plus the current page. Rarely needs changes. |
| `src/pages/` | One `.vue` file per page, with its own logic and scoped styles. |
| `src/pages/index.ts` | Page registry. To add a page, create it in `src/pages/` and add one entry here. |
| `src/components/` | Reusable UI pieces such as `NavBar.vue`. |
| `src/scanners/` | QR (`qrScanner.ts`) and NFC (`nfcScanner.ts`) reading, independent of any page. |
| `src/common.ts` | Helpers shared by several pages (UUID handling, error messages, file names). |
| `src/firebase.ts` | All Firestore access. |
| `src/session.ts` | The logged-in user. |
| `src/navigation.ts` | The current page and `navigate(pageId)`. |
| `src/styles.css` | Global styles shared by every page (panel, buttons, form fields, status, errors). |

Firebase config goes in `.env.local` (see `.env.example`).
