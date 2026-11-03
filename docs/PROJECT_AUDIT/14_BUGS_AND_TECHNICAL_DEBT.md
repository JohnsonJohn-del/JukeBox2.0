# 14. Bugs, Regressions & Technical Debt Report

This document records the exact bugs, code defects, test failures, and build issues identified during verification of the cloned codebase.

---

## 1. Verified Build & Runtime Failures

### Bug 1: Next.js Client Production Build Failure (`next/font/google`)
- **Location**: `packages/client/src/app/layout.tsx` (Lines 17-21)
- **Code**:
  ```typescript
  const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    variable: '--font-cormorant',
    weight: ['400', '500', '600', '700'],
  });
  ```
- **Error Trace**:
  ```
  Failed to compile.
  src\app\layout.tsx
  An error occurred in `next/font`.
  TypeError: Cannot read properties of null (reading '1')
      at D:\AntiGravity D\Jukebox\node_modules\next\dist\compiled\@next\font\dist\google\loader.js:112:78
  ```
- **Root Cause**: `Cormorant_Garamond` font in Next.js 14 Google Fonts loader fails when parsed with array weights under certain Windows Node environments.
- **Fix**: Provide proper weight string configuration or replace with clean CSS web font / safe font definition.

### Bug 2: Server Unit Test Suite Failures (HTTP 500 on missing DB)
- **Location**: `packages/server/tests/auth.test.ts` & `packages/server/tests/room.test.ts`
- **Output**: 3 of 8 tests fail (`Tests: 3 failed, 5 passed, 8 total`).
- **Error Trace**:
  ```
  Expected: 404
  Received: 500
  [ERROR] Supabase URL and key must be provided in environment variables
  ```
- **Root Cause**: The test runner executes integration tests against live controllers that invoke `getDbClient()`. Because no mock DB client or local `.env` exists in CI/test environments, the controllers crash with unhandled errors, returning 500 instead of the expected 401/404 HTTP status codes.

---

## 2. Real-Time & Socket Synchronization Defects

### Bug 3: Immediate Unauthenticated Socket Disconnection
- **Location**: `packages/client/src/sockets/index.ts` (Line 4)
- **Code**:
  ```typescript
  export const socket: Socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });
  ```
- **Root Cause**: `autoConnect: true` fires before the user's token is fetched or initialized. The server middleware (`src/sockets/index.ts:28`) executes:
  ```typescript
  if (!token) return next(new Error('Authentication required'));
  ```
  The socket connection is instantly rejected with `connect_error: Authentication required`.

### Bug 4: Ineffective `disconnect()` Function
- **Location**: `packages/client/src/sockets/index.ts` (Line 14)
- **Code**:
  ```typescript
  export function disconnect(): void {
    console.log('[SOCKET DISCONNECT BLOCKED]');
  }
  ```
- **Root Cause**: The disconnect helper was commented out or disabled by a prior developer to prevent accidental disconnects, leaving the socket hanging open even after room exit.

### Bug 5: Lack of Host Permission Enforcement on Playback Controls
- **Location**: `packages/server/src/sockets/playback.socket.ts` (Lines 60-130)
- **Vulnerability**: While `next_track` properly checks `if (room.host_id !== userId)`, `play`, `pause`, and `seek` handlers contain **zero role checks**:
  ```typescript
  socket.on('seek', async (payload) => {
    const { roomId, position } = payload;
    const state = getOrCreatePlaybackState(roomId);
    state.playbackPosition = position;
    io.to(roomId).emit('seeked', { position });
  });
  ```
- **Impact**: Any guest in the room can open their browser console and emit `socket.emit('seek', { roomId, position: 0 })`, disrupting the party for everyone.

### Bug 6: Ephemeral In-Memory State Loss on Restart
- **Location**: `packages/server/src/sockets/playback.socket.ts` (Line 15)
- **Code**:
  ```typescript
  const roomPlaybackStates = new Map<string, RoomPlaybackState>();
  ```
- **Impact**: If the backend process restarts or crashes, all active room positions, current tracks, and sync timestamps evaporate from memory. When clients reconnect, playback state resets to stopped.

---

## 3. Room & Invitation Bugs

### Bug 7: The Guest Room Join 401 Gate
- **Location**: `packages/server/src/routes/room.routes.ts` (Line 10)
- **Code**:
  ```typescript
  router.post('/join', authenticate, validate(joinRoomSchema), roomController.joinRoom);
  ```
- **Impact**: Unauthenticated users clicking invitation links or scanning QR codes are greeted with a `401 Unauthorized` error toast when entering their nickname.

### Bug 8: Mismatched Invite URL Format
- **Location**: `packages/client/src/components/room/InviteButton.tsx` (Line 16)
- **Code**:
  ```typescript
  const inviteUrl = room ? `${APP_URL}/join?code=${room.roomCode}` : '';
  ```
- **Issue**: The application defines a dynamic route at `src/app/join/[code]/page.tsx`, but `InviteButton` generates a query parameter (`/join?code=...`). Navigating to `/join` with query parameters fails to match the dynamic route without specific query param forwarding.
