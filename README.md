# HabitQuest

HabitQuest turns habits into a game you play with friends. Check in by scanning a habit's QR code or tapping its NFC tag, earn points, and climb the leaderboard. Skip a habit and you pay a fun penalty.

Built with Vue 3 + TypeScript + Vite, packaged with Tauri, with Firebase Firestore as the database.

## Running

```sh
npm install
npm run dev          # browser at http://localhost:1420
npm run tauri dev    # desktop app
npm run build        # type-check + production build
```

Firebase config goes in `.env.local` (gitignored):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Project structure

Each feature lives in its own file so several people can work in parallel without merge conflicts.
Rule of thumb: **work in your own page/component; only touch shared files for small, additive changes.**

| Path | Responsibility |
| --- | --- |
| `src/App.vue` | Shows the login page, or the navbar plus the current page. Rarely needs changes. |
| `src/pages/` | One `.vue` file per page (Today, Scan, Friends, Leaderboard, Profile, Login), with its own logic and scoped styles. |
| `src/pages/index.ts` | Page registry. To add a page, create it in `src/pages/` and add **one line** here. |
| `src/components/` | Reusable UI pieces: `NavBar`, `HabitCard`, `HabitForm`, `QrCodeCard`, `EmojiPicker`. |
| `src/db/` | All Firestore access, one file per collection (`users`, `habits`, `checkins`, `friends`, `badges`) plus `settlement.ts` (penalties and weekly bonus) and `firebase.ts` (setup). |
| `src/game/` | Game rules without any Firebase code: point values (`rules.ts`), avatars/icons/frequencies (`catalog.ts`), badge types (`badges.ts`), scoring helpers (`progress.ts`). |
| `src/scanners/` | QR (`qrScanner.ts`) and NFC (`nfcScanner.ts`) reading/writing, and what the codes contain (`payload.ts`). |
| `src/composables/` | Reusable Vue logic: live friend profiles, today's date. |
| `src/common.ts` | Helpers shared everywhere: UUIDs, dates, error messages, file names. |
| `src/session.ts` | The logged-in player and their live profile. |
| `src/navigation.ts` | The current page and `navigate(pageId)`. |
| `src/styles.css` | Global styles shared by every page (panel, buttons, form fields, stats, list rows). |

## Game rules

All numbers are in `src/game/rules.ts`.

| Action | Points |
| --- | --- |
| Check in by scanning the habit's QR code or NFC sticker | +10 |
| Daily streak reaches 7, 14, 21... days (🔥 badge) | +50 |
| Strictly more points than every friend last week (👑 badge) | +20 |
| Each day without any check-in (streak resets) | −5 |
| 3rd missed day in a row, extra (🐌 Lazy Snail badge) | −15 |

- Checking in is only possible by scanning the habit's own QR code or NFC tag. There is no check-in button and codes can't be typed in.
- One check-in per habit per day.
- The streak counts days with at least one check-in.
- Missed-day penalties start after a player's first check-in.
- There is no server: penalties and the weekly bonus are applied by the player's own app when it starts and before each check-in. They are idempotent, so they are never applied twice.

## Database (Firestore)

Five collections. All dates are `"YYYY-MM-DD"` strings in the player's local time. Weeks start on Monday.

### `users/{userId}`
`userId` is the lowercased nickname.

| Field | Type | Meaning |
| --- | --- | --- |
| `nickname` | string | As typed at sign-up |
| `avatar` | string | Emoji |
| `totalPoints` | number | All-time points |
| `weekPoints` | number | Points in the week starting `weekStart` |
| `weekStart` | string | Monday of the current week |
| `lastWeekPoints` | number | Points in the week before `weekStart` |
| `streak` | number | Days in a row with a check-in, as of `lastCheckInDate` |
| `lastCheckInDate` | string \| null | Last day with any check-in |
| `createdDate` | string | Sign-up day |
| `settledThrough` | string | Last day whose missed-day penalty is already applied |
| `crownedWeek` | string \| null | Monday of the last week the weekly bonus was evaluated for |
| `createdAt` | timestamp | Server time |

### `habits/{habitId}`
`habitId` is a random UUID.

| Field | Type | Meaning |
| --- | --- | --- |
| `userId` | string | Owner |
| `name`, `icon` | string | Name and emoji |
| `timesPerWeek` | number | 1–7 (7 = every day) |
| `tagCode` | string | Secret UUID inside the habit's QR code / NFC sticker |
| `createdDate` | string | |
| `lastCheckInDate` | string \| null | |
| `weekStart` | string \| null | Monday of the week `weekCount` refers to |
| `weekCount` | number | Check-ins that week |
| `totalCheckIns` | number | |
| `createdAt` | timestamp | |

### `checkins/{habitId}_{date}`
The document ID guarantees one check-in per habit per day.

| Field | Type |
| --- | --- |
| `userId`, `habitId`, `date` | string |
| `method` | `"qr"` or `"nfc"` |
| `points` | number (10, without the streak bonus) |
| `createdAt` | timestamp |

### `friends/{userId}:{friendId}`
Stored in both directions, so adding a friend writes two documents.

| Field | Type |
| --- | --- |
| `userId`, `friendId` | string |
| `createdAt` | timestamp |

### `badges/{userId}:{type}:{date}`

| Field | Type |
| --- | --- |
| `userId` | string |
| `type` | `"streak"`, `"lazySnail"` or `"weeklyWinner"` |
| `date` | string |
| `createdAt` | timestamp |

### Queries and indexes
The app only uses single-field equality queries:
- `habits` where `userId ==`
- `habits` where `tagCode ==`
- `friends` where `userId ==`
- `badges` where `userId ==`

Firestore indexes these automatically, so **no composite indexes are needed**. Transactions are used for sign-up, check-ins and settlement.

### Security rules
Login is nickname-only (no Firebase Auth), so the rules cannot tell players apart. `firestore.rules` allows reads and writes on the five collections and denies everything else. That is fine for a hackathon demo, but anyone with the app's config can edit any data.
