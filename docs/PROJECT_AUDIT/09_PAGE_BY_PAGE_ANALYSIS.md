# 09. Page-by-Page Technical & Navigation Analysis

This document provides a comprehensive breakdown of every individual page route in `packages/client/src/app`.

---

## 1. Landing Page (`/` — `src/app/page.tsx`)

1. **Route & Name**: `/` (Landing Page).
2. **Purpose**: The front entrance to Jukebox. Welcomes visitors, explains the platform concept, shows current user's active rooms, and offers room creation or room entry cards.
3. **Why it exists**: Serves as the primary navigation hub before a user enters an active listening session.
4. **UI Structure**:
   - Background with dynamic radial gradient blurs (`jukebox-red`, `jukebox-cyan`, `jukebox-gold`) and retro wood texture.
   - Header with `Hero` component (title, retro subtitle, "Start Listening" call-to-action).
   - Authenticated User Bar: Shows user's name, active rooms badge, and quick-join buttons.
   - Entry Section (`#get-started`): Two side-by-side cards (`CreateRoomCard` and `JoinRoomCard`).
   - Feature Footer: Spinning record icon and animated text: "Listen together in real time with unlimited friends".
5. **Visible Elements**: Hero typography, retro badges, "Welcome Back" panel, Create Room card, Join Room card, navigation links.
6. **Buttons & Functionality**:
   - "Start Listening": Smooth-scrolls down to `#get-started`.
   - "Welcome Back" room chips: Navigates directly to `/room/[id]`.
   - "Create Room": Creates session and navigates to `/room/[id]` (or prompts Sign In if not logged in).
   - "Join Room": Submits 6-character room code and nickname to join.
7. **Interactions & User Actions**: Typing room code, pasting from clipboard, typing nickname, clicking create/join.
8. **Components Used**: `Hero`, `CreateRoomCard`, `JoinRoomCard`, `Card`, `CardContent`, `Button`.
9. **API Endpoints Called**:
   - `GET /api/rooms` (if authenticated, via `roomService.getActiveRooms()`).
   - `POST /api/rooms` (via `CreateRoomCard`).
   - `POST /api/rooms/join` (via `JoinRoomCard`).
10. **Database Tables Involved**: `rooms`, `room_members`.
11. **State Management**: Consumes `useAuthStore` (`user`, `isAuthenticated`).
12. **Auth Requirements**: Publicly viewable. `CreateRoomCard` requires authentication; `JoinRoomCard` claims guest access but fails on backend due to auth requirement.
13. **Navigation Destination**: `/room/[id]` on successful room create or join; `/login` if clicking sign-in prompt.
14. **Bugs & Deficiencies**:
    - Guest joining from this page fails with 401 because `api.ts` does not attach a token and backend requires one.
    - No direct QR scanner button to allow mobile users to scan and join.
15. **Required Modifications**:
    - Enable instant anonymous guest creation upon joining.
    - Add a mobile QR scan/upload button directly on the join card.

---

## 2. Join Invitation Page (`/join/[code]` — `src/app/join/[code]/page.tsx`)

1. **Route & Name**: `/join/[code]` (Join Room Page).
2. **Purpose**: Handles direct link clicks or QR code redirects where the 6-character room code is pre-populated from the URL.
3. **Why it exists**: Enables frictionless sharing where a participant clicks a link shared by the host.
4. **UI Structure**:
   - Central glassmorphism card with neon door icon.
   - Back link to home (`/`).
   - Room code input (prefilled and disabled or editable).
   - Nickname input field.
   - Prominent "Join Room" button with validation status indicator.
5. **Visible Elements**: "Join a Room" title, room code input with paste icon, nickname input, submit button, error banner.
6. **Buttons & Functionality**:
   - "Back to home": Navigates to `/`.
   - Paste button: Extracts room code from clipboard text or URLs matching `room/([A-Z0-9]{6})`.
   - "Join Room": Calls `roomService.joinRoom(roomCode, nickname)`.
7. **API Endpoints Called**: `POST /api/rooms/join`.
8. **State Management**: Local component state for `roomCode`, `nickname`, `loading`, `error`.
9. **Auth Requirements**: Intended for unauthenticated guests, but currently rejects them with 401.
10. **Navigation Destination**: `/room/[id]` upon successful join.
11. **Bugs & Deficiencies**:
    - Hardcoded regex on line 28 expects `room/([a-zA-Z0-9]{6})`, but invite links in `InviteButton.tsx` were generated as `/join?code=...`!
    - When an unauthenticated visitor opens this page, entering their nickname and clicking join throws an error toast: `Request failed with status 401`.
12. **Required Modifications**:
    - Support seamless guest session token issuance without requiring registered accounts.
    - Synchronize URL pattern between `/join/[code]` and `/room/[id]`.

---

## 3. Room & Music Player Page (`/room/[id]` — `src/app/room/[id]/page.tsx`)

1. **Route & Name**: `/room/[id]` (Room Dashboard).
2. **Purpose**: The primary watch and listening room for all participants.
3. **Why it exists**: The core value proposition of Jukebox: synchronized media consumption.
4. **UI Structure**:
   - Dynamic theme wrapper with ambient glow colors extracted from the current track artwork.
   - **Desktop Layout (`lg:grid`)**:
     - Left Column: Visual jukebox player viewport, now-playing track title, progress bar, audio controls, room connection status, host management panel, and invite button.
     - Right Column: Search bar, scrollable playlist queue, and active participants list.
   - **Mobile Layout (`lg:hidden`)**:
     - Sticky top bar with `NowPlaying` summary.
     - Center area for player viewport.
     - Sticky bottom bar with connection indicator, invite button, leave button, and expandable bottom sheet for search and queue.
5. **Visible Elements**: Player arch frame, track title, artist, progress slider, mute/unmute button, play/pause chrome button, skip track button, invite button, WiFi status indicator, search input, queue list, participant list.
6. **Buttons & Functionality**:
   - Play/Pause: Emits `play` or `pause` socket events.
   - Progress bar: Seeks video position (host only) and emits `seek`.
   - Mute/Unmute: Toggles local audio volume without altering other participants.
   - Skip Track: Advances queue to next track (host only).
   - Invite Button: Copies shareable link to clipboard or triggers native OS share sheet.
   - Host Controls: End room or transfer host privileges.
   - Leave Room: Exits session and redirects to `/`.
7. **Components Used**: `Player`, `FooterPlayerControls`, `Queue`, `SearchBar`, `MemberList`, `NowPlaying`, `HostControls`, `InviteButton`.
8. **API Endpoints Called**:
   - `GET /api/rooms/:id` (fetches initial room state, members, and queue).
   - `POST /api/rooms/:id/leave` (on leave).
   - `POST /api/rooms/:id/transfer` (on host transfer).
   - `POST /api/rooms/:id/end` (on host termination).
9. **Socket Events Used**: Subscribes to `playback_state`, `seeked`, `track_changed`, `sync_state`, `queue_updated`, `user_joined`, `user_left`, `host_changed`, `room_closed`.
10. **State Management**: Consumes all 5 stores (`authStore`, `roomStore`, `queueStore`, `playerStore`, `themeStore`).
11. **Bugs & Critical Gaps**:
    - **No Video Mode**: Displays only a static image thumbnail (`<img>`). There is no option to view the video stream.
    - **Hidden Player**: The YouTube Iframe is placed offscreen (`left: -9999px`).
    - **Missing Audio/Video Toggle**: No button or state exists to toggle between song audio and official music video.
    - **No QR Code in Invite**: The invite button only copies text; no QR code modal exists.

---

## 4. Authentication Pages (`/login` & `/signup`)

1. **Routes**: `/login` (`src/app/login/page.tsx`) and `/signup` (`src/app/signup/page.tsx`).
2. **Purpose**: Provide account registration and sign-in for users who want persistent accounts.
3. **UI Structure**: Centered glassmorphic card with gradient music icon, input fields, submit button, and toggle link between login and signup.
4. **Visible Elements**: Email, password, username (signup only), submit button, error messages.
5. **API Endpoints Called**: `POST /api/auth/login` and `POST /api/auth/register`.
6. **Navigation Flow**: On successful authentication, sets JWT in `authStore` and redirects to `/`.
