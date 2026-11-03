# 10. Component-by-Component Technical Analysis

This document audits every custom React component in `packages/client/src/components`.

---

## 1. Room Components (`src/components/room/`)

### 1. `Player.tsx`
- **Responsibility**: Renders the central jukebox player display, playback progress, time stamps, and playback control buttons.
- **Internal State**: `muted: boolean`, `userInteracted: boolean`, `seekHover: number | null`.
- **Store Dependencies**: `usePlayerStore`, `useQueueStore`, `useRoomStore`, `useSocket`.
- **Lifecycle & Execution**:
  - Initializes `usePlayer('youtube-player')`.
  - Listens to socket events: `playback_state`, `seeked`, `track_changed`, `sync_state`.
  - When `track_changed` arrives, calls `loadVideo(videoId)` and `play()`.
  - Renders an arch frame with an `<img>` tag showing `getThumbnailUrl(currentTrack)`.
- **Defects & Limitations**:
  - Completely omits the YouTube video iframe from the visible viewport.
  - No mechanism to switch between video mode and audio mode.
  - Does not indicate whether the current song has a music video available.

### 2. `FooterPlayerControls.tsx`
- **Responsibility**: Provides desktop bottom player controls (play/pause, skip, volume slider, progress track).
- **Store Dependencies**: `usePlayerStore`, `useQueueStore`, `useRoomStore`, `useSocket`.
- **Defects**: Mirrors functionality of `Player.tsx` controls; lacks Audio/Video switch button.

### 3. `InviteButton.tsx`
- **Responsibility**: Provides a button to copy the room invitation URL and display the 6-character room code.
- **Internal State**: `copied: boolean`.
- **Store Dependencies**: `useRoomStore`.
- **Defects**:
  - Generates URL as `${APP_URL}/join?code=${room.roomCode}`, which does not match the `/join/[code]` dynamic route format.
  - Contains **zero QR code generation**. Does not render or offer a QR code for mobile scanning.

### 4. `Queue.tsx`
- **Responsibility**: Displays the scrollable list of queued tracks awaiting playback, with drag-and-drop or reorder controls and remove buttons.
- **Store Dependencies**: `useQueueStore`, `useRoomStore`, `useAuthStore`, `useSocket`.
- **Features**: Displays track thumbnail, title, artist, duration, and badge indicating whether the item was added by the current user. Allows host to reorder tracks.

### 5. `SearchBar.tsx`
- **Responsibility**: Live search input with debounce (300ms) that queries `/api/search?q=...` and displays dropdown results.
- **Store Dependencies**: `useQueue`, `useQueueStore`, `useAuthStore`.
- **Features**: Prevents users from adding songs if on a 30-second cooldown or if they have reached the 7-song limit.
- **Defects**: Does not display whether a search result is an audio track or an official music video.

### 6. `MemberList.tsx`
- **Responsibility**: Displays the list of current participants in the room, highlighting the host with a crown/host badge.
- **Store Dependencies**: `useRoomStore`, `useAuthStore`.

### 7. `NowPlaying.tsx`
- **Responsibility**: Compact mobile header bar showing the active track's thumbnail, title, artist, and an expand button to open the mobile drawer.

### 8. `HostControls.tsx`
- **Responsibility**: Modal dialog offering host-specific administrative actions: transferring host privileges to another member, or ending/deactivating the room.

---

## 2. Landing Components (`src/components/landing/`)

### 1. `Hero.tsx`
- **Responsibility**: Promotional hero banner with animated typography, retro neon styling, and "Start Listening" anchor link button.

### 2. `CreateRoomCard.tsx`
- **Responsibility**: Prompts user for optional room name and triggers `roomService.createRoom()`.
- **Conditional Logic**: If user is unauthenticated, replaces the input with a "Sign In to Create Room" button pointing to `/login`.

### 3. `JoinRoomCard.tsx`
- **Responsibility**: Allows visitors to input a 6-character room code and display nickname.
- **Validation**: Regex check for 6-character alphanumeric code; nickname must be 2-20 characters.
- **Critical Defect**: Directly submits to `/api/rooms/join`, causing 401 errors for unauthenticated users despite being labeled as "Guest Entry".

---

## 3. Layout Components (`src/components/layout/`)

### 1. `Navbar.tsx`
- **Responsibility**: Sticky global header bar.
- **Features**:
  - Jukebox logo with spinning neon record.
  - Light/Dark theme toggle button (`toggleTheme`).
  - User avatar dropdown menu (shows username, Profile, Sign Out).
  - Login / Sign Up buttons for unauthenticated visitors.
  - Mobile hamburger menu overlay.

### 2. `Providers.tsx`
- **Responsibility**: Wraps the application with `QueryClientProvider` (TanStack React Query) and `Toaster` (React Hot Toast).
