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

**Debug menu.** In development (`npm run dev`, `npm run tauri dev`) a see-through menu in the bottom-left corner moves the app's date a day forwards or backwards, to test schedules, penalties and taunts. Everything saved meanwhile (check-ins, penalties, taunts) uses the emulated date, so use test habits and accounts. Reloading goes back to the real date. To show it in a production build, set `VITE_DEBUG_MENU=true`.

Firebase config goes in `.env.local` (gitignored). Also follow the Firebase setup checklist under "Security" below.

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
| `src/pages/` | One `.vue` file per page (Habits, Scan, Friends, Profile, Login), with its own logic and scoped styles. |
| `src/pages/index.ts` | Page registry. To add a page, create it in `src/pages/` and add **one line** here. |
| `src/components/` | Reusable UI pieces: `NavBar`, `HabitCard`, `HabitForm`, `SchedulePicker` (how a habit repeats), `HabitLeaderboard` (a habit's own leaderboard), `HabitMembers` (friends' activity in a habit), `FriendHabits` (habits to join), `TauntComposer` (the leader writes a taunt), `TauntBanner` (a taunt at you, above the habit's card), `QrCodeCard`, `EmojiPicker`. |
| `src/db/` | All Firestore access, one file per collection (`users`, `habits`, `checkins`, `friends`, `badges`, `taunts`) plus `settlement.ts` (penalties), `auth.ts` (registration and login with Firebase Authentication), `sha256.ts` and `firebase.ts` (setup). |
| `src/game/` | Game rules without any Firebase code: point values (`rules.ts`), habit schedules (`schedule.ts`), avatars/icons/frequencies (`catalog.ts`), badge types (`badges.ts`), scoring helpers (`progress.ts`), who can taunt whom (`taunts.ts`). |
| `src/scanners/` | QR (`qrScanner.ts`) and NFC (`nfcScanner.ts`) reading/writing, and what the codes contain (`payload.ts`). |
| `src/composables/` | Reusable Vue logic: live friend profiles, cached profiles of any player, today's date. |
| `src/common.ts` | Helpers shared everywhere: UUIDs, dates, error messages, file names. |
| `src/session.ts` | The logged-in player (from Firebase Authentication) and their live profile. |
| `src/navigation.ts` | The current page and `navigate(pageId)`. |
| `src/styles.css` | Global styles shared by every page (panel, buttons, form fields, stats, list rows). |

## Game rules

All numbers are in `src/game/rules.ts`. **Points belong to a habit, not to the account:** every habit has its own global leaderboard of all its members, and everything below is earned or lost in that habit only.

| Action | Points |
| --- | --- |
| Check in by scanning the habit's QR code or NFC sticker | +10 |
| Every 7th check-in in a row without a penalty (🔥 badge) | +50 |
| Each miss: a scheduled weekday without a check-in, or a check-in short of the target when an "X times every Y days" cycle ends (streak resets) | −5 |
| 3 misses in a row, extra (🐌 Lazy Snail badge) | −15 |

- Habits are shared. Anyone can create one and download or print its QR code. Others join by scanning it or from "Your friends' habits" on the Habits page. The first scan only adds the habit to the account (no check-in, no points); later scans check in.
- Each habit card shows your points and rank in that habit, your friends' activity, and the full leaderboard (👑 for a clear leader). Leaving a habit drops your points in it.
- Checking in is only possible by scanning the habit's own QR code or NFC tag. There is no check-in button and codes can't be typed in.
- One check-in per player per habit per day, unless the schedule allows more (see above).
- Each habit repeats on one of two kinds of schedule, set when it is created:
  - **X times every Y days** (X ≤ 20, Y ≤ 31; X may exceed Y, e.g. "3 times a day"). Cycles of Y days start on the habit's creation date and are the same for every member. At most X ÷ Y check-ins (rounded up) are allowed per day. Once X check-ins are done, the next one waits for the next cycle.
  - **On set weekdays** (any combination of Mon–Sun). Check-ins are only possible on those days.
- Penalties start after joining: for weekday schedules from the day after joining, for interval schedules with the first cycle that starts after the joining day.
- **Damage.** When a player's points in a habit dropped through penalties since they last looked (each device remembers the last points it showed), a "−X pts" card pops up over that habit's card, stays for 2 seconds and then fades out over 2 seconds.
- **Taunts.** The habit's leader (👑) can taunt members who haven't checked in today but still can, from the habit's leaderboard: 1–5 emojis plus an optional message (up to 100 characters). The taunted player sees it live, animated over that habit's card (it can be shrunk to a badge that slowly circles the card), and everyone sees "Taunted" next to them in the leaderboard. It stays until they check in (scanning cancels it in the same transaction) or leave the habit. A new taunt at the same player in the same habit replaces the old one. Taunts cost no points.
- There is no server: when any member opens the app or checks in, every member of that habit is charged what they owe. A player who never opens the app still loses points. This is idempotent, so nothing is charged twice. Leaderboards also include penalties that are due but not saved yet.

## Database (Firestore)

Six collections. All dates are `"YYYY-MM-DD"` strings in the player's local time. Weeks start on Monday.

### `users/{userId}`
`userId` is the lowercased nickname. Accounts hold no points (see `habits.members`).

| Field | Type | Meaning |
| --- | --- | --- |
| `nickname` | string | As typed at sign-up |
| `avatar` | string | Emoji |
| `createdDate` | string | Sign-up day |
| `uid` | string | The Firebase Authentication user that owns this account |
| `createdAt` | timestamp | Server time |

### `habits/{habitId}`
`habitId` is a random UUID. Habits are shared: anyone can join one, and all members check in by scanning the same tag.

| Field | Type | Meaning |
| --- | --- | --- |
| `creatorId` | string | Who created it (no special rights afterwards) |
| `name`, `icon` | string | Name and emoji |
| `schedule` | map | `{ type: "interval", times, days }` (X times every Y days) or `{ type: "weekdays", days: [0–6] }` (0 = Monday). Older habits with only `timesPerWeek` are read as interval schedules. |
| `tagCode` | string | Secret UUID inside the habit's QR code / NFC sticker |
| `createdDate` | string | |
| `memberIds` | string[] | Members' user IDs (used for querying) |
| `members` | map | `{ [userId]: { joinedDate, lastCheckInDate, lastDateCount, periodStart, periodCount, totalCheckIns, points, streak, missedInRow, settledThrough } }`: each member's progress and points in this habit's leaderboard |
| `createdAt` | timestamp | |

`memberIds` and `members` always contain the same users and are always written together in a transaction. `periodCount` counts check-ins in the cycle (or, for weekday schedules, the Monday–Sunday week) starting on `periodStart`. `missedInRow` counts misses since the last check-in. `settledThrough` is the last day whose misses are already charged. The last member to leave deletes the habit.

### `checkins/{habitId}:{userId}:{date}:{number}`
`number` is the check-in's position that day (1, 2, ...). The per-day limit is enforced from the member's `lastDateCount` inside the check-in transaction.

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

### `taunts/{habitId}:{targetId}`
At most one taunt per player and habit; sending another one replaces it. Deleted when the target checks in or leaves the habit.

| Field | Type | Meaning |
| --- | --- | --- |
| `habitId` | string | |
| `targetId` | string | The taunted member |
| `fromId` | string | The leader who sent it |
| `emojis` | string[] | 1–5 emojis from `TAUNT_EMOJIS` in `src/game/taunts.ts` |
| `message` | string | Optional, up to 100 characters |
| `date` | string | Day it was sent |
| `createdAt` | timestamp | |

### Queries and indexes
The app only uses single-field queries:
- `habits` where `memberIds array-contains`
- `habits` where `memberIds array-contains-any` (friends' habits, in groups of 30)
- `habits` where `tagCode ==`
- `friends` where `userId ==`
- `badges` where `userId ==`
- `taunts` where `targetId ==` (taunts at you) and where `habitId ==` (a habit's leaderboard)

Firestore indexes these automatically, so **no composite indexes are needed**. Transactions are used for sign-up, check-ins, settlement and taunts.

### Security

**Accounts.** Players register and log in with a nickname and a password, using Firebase Authentication (email/password provider).
- Passwords are sent only to Firebase Authentication over HTTPS. Google hashes them with scrypt and rate-limits guessing. Neither the app nor Firestore ever stores a password or a password hash.
- Firebase needs an email address, so each nickname maps to `<sha256(lowercased nickname)>@habitrivals.app`. No email is ever sent.
- Passwords must be 6–128 characters (6 is the minimum Firebase Authentication accepts) and different from the nickname.
- Login errors never reveal whether the nickname or the password was wrong.
- The login is kept by Firebase across restarts. Registering never logs the player in. If creating the player account fails, the new login is deleted again.

**Rules.** `firestore.rules` requires a signed-in user for everything. It ties each player account to its login by recomputing the login email from the account's ID, so nobody can create or edit someone else's account. Players can only add or remove themselves as habit members, write their own check-ins, and change only membership fields of a habit. Taunts must come from the signed-in player, at another member of the same habit, with emojis from the list; only the taunted player can delete one. Field lists, ID formats and timestamps are checked, and anything not listed is denied.

**Known limits (no server code).** Penalties are applied by whichever member opens the app, so the rules have to let members update each other's habit stats. A signed-in player who calls the Firestore API directly (bypassing the app) could therefore change points in habits they belong to. Any signed-in player can also read habits' tag codes through the API. The rules can't check that a taunt's sender leads the habit or that the target hasn't checked in yet (that needs the penalty calculation), so only the app checks it. Closing these gaps needs Cloud Functions to apply check-ins and penalties on the server.

### Firebase setup checklist
1. **Authentication → Sign-in method:** enable **Email/Password**. Leave email link sign-in off.
2. **Firestore → Rules:** paste `firestore.rules` and publish.
3. Delete any `users` documents created before passwords existed. They have no login, so their nicknames can't be registered or used.
4. If the API key is restricted to certain websites in Google Cloud Console, add the deployed site and `tauri.localhost`.
