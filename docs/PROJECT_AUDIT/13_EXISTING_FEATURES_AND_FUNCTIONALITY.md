# 13. Existing Features & Functionality Verification

This document provides a realistic, verified inventory of what actually works, what is partially implemented, and what is broken in the original codebase.

---

## 1. Feature Status Matrix

| Module / Feature | Baseline Status | Technical Verification Finding |
| :--- | :--- | :--- |
| **User Registration** | Fully Functional | `POST /api/auth/register` creates user with bcrypt salt 12 and returns signed JWT. |
| **User Login** | Fully Functional | `POST /api/auth/login` verifies credentials and issues valid JWT. |
| **Get Current User (`/me`)** | Fully Functional | Authenticated profile retrieval functions as expected when DB is connected. |
| **Room Creation (Logged-in)** | Fully Functional | `POST /api/rooms` creates room row and assigns host. |
| **Room Listing** | Fully Functional | `GET /api/rooms` returns active rooms for the authenticated user. |
| **Guest Room Join** | **Completely Broken** | Fails with HTTP 401 because `authenticate` middleware is enforced on `/api/rooms/join`. |
| **QR Code Generation** | **Non-Existent** | No QR code library installed or component written anywhere in client or server. |
| **Shareable Invite URL** | Partially Working | Generates `${APP_URL}/join?code=...`, but client route expects `/join/[code]` parameter. |
| **Music Search (Primary)** | **Broken** | Tries to reach `http://localhost:5000/search` which does not exist in the repository. |
| **Music Search (Fallback)** | Working (Fragile) | Scrapes `youtube.com/results` HTML with regex. Functional but vulnerable to YouTube DOM changes. |
| **Song Queueing** | Fully Functional | Songs add to queue with 30s cooldown and 7-song limit per user. |
| **Queue Reordering** | Fully Functional | Host can reorder positions via `reorder_queue` socket event. |
| **Audio Playback** | Working (Disguised) | YouTube IFrame player plays audio in hidden 1px element offscreen (`left: -9999px`). |
| **Video Playback** | **Non-Existent** | No video iframe is rendered on screen. Shows only a static thumbnail `<img>`. |
| **Audio / Video Mode Switch**| **Non-Existent** | No UI toggle, no socket event, no database column for video counterpart. |
| **Real-time Play/Pause** | Partially Working | Emits socket events to room, but any guest can trigger them without host permission checks. |
| **Real-time Seek** | Partially Working | Emits seek event to room; lacks host permission check. |
| **Drift Correction** | Rudimentary | Checks if `|localTime - serverPosition| > 2`, then calls `seekTo()`. Can cause audio stuttering. |
| **Dynamic Palette Extraction** | Fully Functional | Uses `node-vibrant` on track thumbnails to tint `--room-primary` and neon borders. |
| **Dark / Light Theme Toggle** | Fully Functional | Toggles dark/light class on HTML root element via `useThemeStore`. |
| **Automated Tests** | **Failing** | `npm test -w packages/server` fails (3 of 8 tests fail with 500 when Supabase unconfigured). |
| **Client Production Build** | **Failing** | `npm run build -w packages/client` fails due to `next/font/google` invalid font weight format. |

---

## 2. In-Depth Operational Analysis

### 1. The Disguised Audio-Only Player
The original developer intentionally avoided building an actual video player:
- In `packages/client/src/hooks/usePlayer.ts`:
  ```typescript
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1px';
  container.style.height = '1px';
  ```
- In `packages/client/src/components/room/Player.tsx`:
  ```tsx
  <motion.img
    key={currentTrack.videoId}
    src={thumbnailUrl}
    alt={currentTrack.title}
    className="aspect-video w-full object-cover"
  />
  ```
- **Consequence**: Users had no way of watching music videos together. This directly contradicts the core scenario required by the user ("watch the same music video together, listen simultaneously").

### 2. Search Fallback Brittleness
In `packages/server/src/services/search.service.ts`:
```typescript
const regex = /(?:var\s+ytInitialData\s*=\s*|window\[['"]ytInitialData['"]\]\s*=)(.+?)(?:;|\s*<\/script>)/s;
```
If YouTube alters its script tag structure or issues a CAPTCHA challenge to the server's IP, search immediately breaks and throws `SEARCH_FAILED` (502).
