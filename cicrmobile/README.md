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
