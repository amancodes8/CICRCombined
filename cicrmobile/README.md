# CICR Connect – Mobile App

A React Native (Expo) mobile app for the CICR Connect platform, with the same dark-themed UI and features as the web dashboard.

## Screenshots

| Login | Register |
|-------|----------|
| ![Login](https://github.com/user-attachments/assets/f9057c66-741e-4b43-9cd1-ed71b36de225) | ![Register](https://github.com/user-attachments/assets/adecfb86-335b-4e00-9464-bc8417d5853b) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.83 |
| Platform | Expo SDK 55 |
| Navigation | React Navigation 7 (bottom tabs + native stacks) |
| HTTP | Axios 1.13.5 |
| Auth Storage | expo-secure-store |
| Icons | @expo/vector-icons (Ionicons) |
| Animations | expo-linear-gradient |

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm or yarn
- Expo CLI (`npx expo`)
- Expo Go app on your phone (for development)

### Install & Run

```bash
cd cicrmobile
npm install

# Start development server
npx expo start

# Platform-specific
npx expo start --ios      # iOS simulator
npx expo start --android  # Android emulator
npx expo start --web      # Web browser
```

### Scan QR Code

After running `npx expo start`, scan the QR code with:
- **iOS**: Camera app → tap the Expo notification
- **Android**: Expo Go app → scan QR

## Project Structure

```
cicrmobile/
├── App.js                          # Entry point (AuthProvider + Navigator)
├── app.json                        # Expo configuration
├── src/
│   ├── api/index.js                # Axios API layer (same backend endpoints)
│   ├── hooks/useAuth.js            # Auth context (token + user state)
│   ├── theme/index.js              # Design tokens (colors, spacing, typography)
│   ├── components/
│   │   ├── UI.js                   # Shared primitives (Card, Badge, Avatar, KpiTile…)
│   │   └── ScreenWrapper.js        # Page wrapper with header
│   ├── navigation/
│   │   └── AppNavigator.js         # Tab + Stack navigation
│   └── screens/
│       ├── Auth/LoginScreen.js     # Login / Register / Forgot Password
│       ├── Dashboard/              # KPIs, meetings, projects, posts
│       ├── Projects/               # List + Details
│       ├── Community/              # Discussion feed with likes
│       ├── Meetings/               # Upcoming & past meetings
│       ├── Events/                 # List + Details
│       ├── Profile/                # Edit profile, change password, sign out
│       └── More/                   # Members, Inventory, Learning, Programs,
│                                   # Tasks, Notifications, Admin Panel
```

## Features

### Screens (matching web app)

- **Auth** – Login, register (with invite code), forgot password (email OTP or admin code)
- **Dashboard** – KPI tiles, upcoming meetings, recent projects, community posts
- **Projects** – Search & filter by status, progress bars, team info, project details
- **Community** – Post feed, create posts, like/unlike with optimistic updates
- **Meetings** – Upcoming/past tabs, date/time/attendee info, meeting links
- **Events** – Event cards with date strips, location, registration counts
- **Profile** – Avatar, edit name/phone/bio, change password, sign out
- **More** – Hub linking to Members directory, Inventory, Learning Hub, Programs Hub, Tasks, Notifications, Admin Panel

### Design System

The mobile app uses the exact same dark theme as the web app:

- **Surfaces**: `#070a0f` → `#181f2a` (gradient depth)
- **Accent**: Sky blue `#38bdf8` with purple accents `#a78bfa`
- **Cards**: Glass-morphism with subtle borders
- **Status badges**: Color-coded (emerald/amber/rose/cyan)

## API

The app connects to the same backend as the web app:

```
https://cicrcombined.onrender.com/api
```

Authentication uses Bearer tokens stored securely via `expo-secure-store`.

## Building for Production

```bash
# Web export
npx expo export --platform web

# Native builds (requires EAS)
npx eas build --platform android
npx eas build --platform ios
```

### APK Build via GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/build-apk.yml`) that
automatically builds a release APK whenever changes are pushed to `cicrmobile/` on `main`.
You can also trigger it manually from the **Actions** tab using **workflow_dispatch**.

**Estimated build times** (on `ubuntu-latest`):

| Step | Typical Duration |
|------|-----------------|
| Setup (checkout, Java 17, Node 22) | ~10 s |
| `npm ci` | ~10 – 20 s |
| `expo prebuild` | ~5 s |
| Gradle `assembleRelease` (cold cache) | ~8 – 12 min |
| Gradle `assembleRelease` (warm cache) | ~4 – 6 min |
| **Total (first run)** | **~10 – 15 min** |
| **Total (cached)** | **~5 – 8 min** |

> Exact times are printed in the **Job Summary** of each workflow run.
> Gradle dependency & build caches are stored between runs to speed up subsequent builds.

### Building APK from VS Code

You can build the APK directly from VS Code's integrated terminal without leaving the editor.

#### Prerequisites

| Requirement | Why |
|-------------|-----|
| **JDK 17** | Gradle needs it to compile native code |
| **Android SDK** (via Android Studio or command-line tools) | Provides build tools, platform APIs |
| **`ANDROID_HOME`** env variable set | Gradle uses it to locate the SDK |
| **Node.js ≥ 18** | Runs Expo CLI and JS bundler |

> **Tip:** Install [Android Studio](https://developer.android.com/studio) — it bundles the SDK, JDK, and emulator. After installation, set `ANDROID_HOME` to the SDK path (e.g. `~/Library/Android/sdk` on macOS, `%LOCALAPPDATA%\Android\Sdk` on Windows, `~/Android/Sdk` on Linux).

#### Option 1 — npm script (recommended)

Open the VS Code **Terminal** (`` Ctrl+` ``) and run:

```bash
cd cicrmobile
npm install                # first time only
npm run build:android      # prebuild + Gradle assembleRelease
```

The APK is written to:

```
cicrmobile/android/app/build/outputs/apk/release/app-release.apk
```

Use `npm run build:android:clean` to regenerate the native project from scratch (useful after changing `app.json` or adding native plugins).

#### Option 2 — VS Code Task

The repo includes a `.vscode/tasks.json` with pre-configured build tasks:

1. Press **Ctrl+Shift+P** (or **Cmd+Shift+P** on macOS)
2. Type **"Tasks: Run Task"** and select it
3. Choose **Build Android APK** (or **Build Android APK (clean)**)

The build output appears in the VS Code terminal panel.

#### Option 3 — EAS Build (cloud, no local SDK needed)

If you don't have the Android SDK installed locally, use Expo's cloud build service:

```bash
cd cicrmobile
npx eas login                          # sign in to your Expo account
npx eas build --platform android --profile preview   # builds APK in the cloud
```

EAS Build takes ~10–15 min. The APK download link is printed when the build finishes.
