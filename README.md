# HabitRivals

HabitRivals turns habits into a game you play with friends. Check in by scanning a habit's QR code or tapping its NFC tag, earn points, and climb the leaderboard. Skip a habit and you pay a fun penalty.

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
| `src/pages/` | One `.vue` file per page (Today, Scan, Friends, Profile, Login), with its own logic and scoped styles. |
| `src/pages/index.ts` | Page registry. To add a page, create it in `src/pages/` and add **one line** here. |
| `src/components/` | Reusable UI pieces: `NavBar`, `HabitCard`, `HabitForm`, `HabitLeaderboard` (a habit's own leaderboard), `HabitMembers` (friends' activity in a habit), `FriendHabits` (habits to join), `QrCodeCard`, `EmojiPicker`. |
| `src/db/` | All Firestore access, one file per collection (`users`, `habits`, `checkins`, `friends`, `badges`) plus `settlement.ts` (penalties and weekly bonus) and `firebase.ts` (setup). |
| `src/game/` | Game rules without any Firebase code: point values (`rules.ts`), avatars/icons/frequencies (`catalog.ts`), badge types (`badges.ts`), scoring helpers (`progress.ts`). |
| `src/scanners/` | QR (`qrScanner.ts`) and NFC (`nfcScanner.ts`) reading/writing, and what the codes contain (`payload.ts`). |
| `src/composables/` | Reusable Vue logic: live friend profiles, cached profiles of any player, today's date. |
| `src/common.ts` | Helpers shared everywhere: UUIDs, dates, error messages, file names. |
| `src/session.ts` | The logged-in player and their live profile. |
| `src/navigation.ts` | The current page and `navigate(pageId)`. |
| `src/styles.css` | Global styles shared by every page (panel, buttons, form fields, stats, list rows). |

## Game rules

All numbers are in `src/game/rules.ts`. **Points belong to a habit, not to the account:** every habit has its own global leaderboard of all its members, and everything below is earned or lost in that habit only.

| Action | Points |
| --- | --- |
| Check in by scanning the habit's QR code or NFC sticker | +10 |
| Every 7th check-in in a row without a penalty (🔥 badge) | +50 |
| Daily habit: each day without a check-in (streak resets) | −5 |
| Daily habit: 3rd missed day in a row, extra (🐌 Lazy Snail badge) | −15 |
| Weekly habit: each check-in short of the weekly target, charged when the week ends (streak resets) | −5 |
| Weekly habit: a whole week without check-ins, extra (🐌 Lazy Snail badge) | −15 |

- Habits are shared. Anyone can create one and download or print its QR code. Others join by scanning it (which also checks them in) or from "Your friends' habits" on the Today page.
- Each habit card shows your points and rank in that habit, your friends' activity, and the full leaderboard (👑 for a clear leader). Leaving a habit drops your points in it.
- Checking in is only possible by scanning the habit's own QR code or NFC tag. There is no check-in button and codes can't be typed in.
- One check-in per player per habit per day.
- Penalties start the day after joining a daily habit, and with the first full week after joining a weekly habit.
- There is no server: when any member opens the app or checks in, every member of that habit is charged what they owe. A player who never opens the app still loses points. This is idempotent, so nothing is charged twice. Leaderboards also include penalties that are due but not saved yet.

## Database (Firestore)

Five collections. All dates are `"YYYY-MM-DD"` strings in the player's local time. Weeks start on Monday.

### `users/{userId}`
`userId` is the lowercased nickname. Accounts hold no points (see `habits.members`).

| Field | Type | Meaning |
| --- | --- | --- |
| `nickname` | string | As typed at sign-up |
| `avatar` | string | Emoji |
| `createdDate` | string | Sign-up day |
| `createdAt` | timestamp | Server time |

### `habits/{habitId}`
`habitId` is a random UUID. Habits are shared: anyone can join one, and all members check in by scanning the same tag.

| Field | Type | Meaning |
| --- | --- | --- |
| `creatorId` | string | Who created it (no special rights afterwards) |
| `name`, `icon` | string | Name and emoji |
| `timesPerWeek` | number | 1–7 (7 = every day) |
| `tagCode` | string | Secret UUID inside the habit's QR code / NFC sticker |
| `createdDate` | string | |
| `memberIds` | string[] | Members' user IDs (used for querying) |
| `members` | map | `{ [userId]: { joinedDate, lastCheckInDate, weekStart, weekCount, totalCheckIns, points, streak, settledThrough } }`: each member's progress and points in this habit's leaderboard |
| `createdAt` | timestamp | |

`memberIds` and `members` always contain the same users and are always written together in a transaction. `settledThrough` is the last day whose missed check-ins are already charged. The last member to leave deletes the habit.

### `checkins/{habitId}:{userId}:{date}`
The document ID guarantees one check-in per player per habit per day.

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

### `badges/{userId}:{type}:{date}:{habitId}`

| Field | Type |
| --- | --- |
| `userId` | string |
| `type` | `"streak"` or `"lazySnail"` |
| `date` | string |
| `habitId`, `habitName` | string (the name is copied so it survives the habit being deleted) |
| `createdAt` | timestamp |

### Queries and indexes
The app only uses single-field queries:
- `habits` where `memberIds array-contains`
- `habits` where `memberIds array-contains-any` (friends' habits, in groups of 30)
- `habits` where `tagCode ==`
- `friends` where `userId ==`
- `badges` where `userId ==`

Firestore indexes these automatically, so **no composite indexes are needed**. Transactions are used for sign-up, check-ins and settlement.

### Security rules
Login is nickname-only (no Firebase Auth), so the rules cannot tell players apart. `firestore.rules` allows reads and writes on the five collections and denies everything else. That is fine for a hackathon demo, but anyone with the app's config can edit any data.
