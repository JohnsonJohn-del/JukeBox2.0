# 02. Technology Stack & Dependency Inventory

## 1. Monorepo Infrastructure

The project uses standard **npm workspaces** configured in the root `package.json`:
- **Workspace Directories**: `packages/*` (`packages/client` and `packages/server`).
- **Node Engine Constraint**: Defined as `node: ">=20.0.0"` in root `package.json` and `node: "22.x"` in `packages/server/package.json`.
- **Root Tooling**:
  - `concurrently (^9.2.1)`: Used to run both client and server development servers simultaneously (`npm run dev`).
  - `prettier (^3.2.5)`: Code formatting.

---

## 2. Frontend Technology Stack (`packages/client`)

### Core Framework & Runtime
- **Next.js (`^14.2.2`)**: React framework using the modern App Router (`/src/app`).
- **React (`^18.3.1`) & React DOM (`^18.3.1`)**: Component-based UI rendering.
- **TypeScript (`^5.4.5`)**: Static type safety across client source code.

### UI & Styling
- **Tailwind CSS (`^3.4.3`)**: Utility-first CSS framework configured via `tailwind.config.ts` with custom jukebox color variables (`--jukebox-gold`, `--jukebox-red`, `--jukebox-cyan`, etc.).
- **PostCSS (`^8.4.38`) & Autoprefixer (`^10.4.19`)**: CSS processing.
- **Framer Motion (`^11.0.22`)**: Animation library for landing transitions, jukebox glow effects, card reveals, and dialogs.
- **Lucide React (`^0.378.0`)**: Comprehensive iconography (Play, Pause, Skip, Users, Radio, Disc3, etc.).
- **Radix UI Primitives**: Accessible headless UI components:
  - `@radix-ui/react-avatar (^1.0.4)`
  - `@radix-ui/react-dialog (^1.0.5)`
  - `@radix-ui/react-dropdown-menu (^2.0.6)`
  - `@radix-ui/react-scroll-area (^1.0.5)`
  - `@radix-ui/react-slot (^1.0.2)`
  - `@radix-ui/react-tooltip (^1.0.7)`
- **Class Utilities**:
  - `clsx (^2.1.1)` & `tailwind-merge (^2.3.0)`: Dynamic conditional class consolidation (`cn` utility).
  - `class-variance-authority (^0.7.0)`: Design system component variants.

### State Management & Data Fetching
- **Zustand (`^4.5.2`)**: Lightweight reactive state stores:
  - `authStore`: User session, JWT tokens, authentication status.
  - `roomStore`: Current active room metadata, host status, room members.
  - `queueStore`: Playlist queue and currently active track item.
  - `playerStore`: Playback position, duration, and playing/paused state.
  - `themeStore`: Dynamic theme colors extracted from album art.
- **TanStack React Query (`^5.32.0`)**: Asynchronous state management and caching.
- **React Hook Form (`^7.51.3`) & @hookform/resolvers (`^3.3.4`)**: Form validation with Zod.
- **Zod (`^3.22.5`)**: Runtime schema validation.

### Real-Time & Media Playback
- **Socket.IO Client (`^4.7.5`)**: Real-time WebSocket connection to the backend server.
- **YouTube IFrame API (`@types/youtube ^0.2.0`)**: Official YouTube client-side playback engine via `window.YT.Player`.
- **Node-Vibrant (`^3.1.6`)**: Color extraction library analyzing track thumbnails to dynamically tint the UI.
- **React Hot Toast (`^2.4.1`)**: Floating user notifications and alerts.

---

## 3. Backend Technology Stack (`packages/server`)

### Core Server & Runtime
- **Node.js**: Target runtime `22.x` (verified running on Node `v24.11.0`).
- **Express (`^4.19.2`)**: HTTP REST API web server.
- **TypeScript (`^5.4.5`)**: Transpiled via `tsc` to `dist/` or executed directly in development with `tsx (^4.7.2)`.

### Networking, Sockets & Security
- **Socket.IO (`^4.7.5`)**: Real-time event broadcasting and room namespace management.
- **ws (`^8.18.3`) & @types/ws (`^8.18.1`)**: Underlying WebSocket protocol transport.
- **Helmet (`^7.1.0`)**: HTTP response security headers.
- **CORS (`^2.8.5`)**: Cross-Origin Resource Sharing handling with credentials support.
- **Express Rate Limit (`^7.2.0`)**: IP-based rate limiting (100 requests per 15 minutes).
- **Cookie Parser (`^1.4.6`)**: HTTP cookie parsing middleware.
- **Morgan (`^1.10.0`)**: HTTP request logging.

### Authentication & Validation
- **JSON Web Token (`jsonwebtoken ^9.0.2`)**: Bearer token signing and verification using HMAC SHA-256.
- **Bcrypt.js (`bcryptjs ^2.4.3`)**: Password hashing with 12 salt rounds.
- **UUID (`uuid ^9.0.1`)**: UUID v4 generation for users, rooms, members, and queue items.
- **Zod (`^3.22.5`)**: Strict schema validation for request payloads and socket parameters.

### Database & External APIs
- **@supabase/supabase-js (`^2.42.5`)**: Client library communicating with Supabase PostgreSQL.
- **Axios (`^1.6.8`)**: Outgoing HTTP client used for music search queries.

### Testing & Linting
- **Jest (`^29.7.0`) & ts-jest (`^29.1.2`)**: Unit and integration test runner.
- **Supertest (`^6.3.4`)**: HTTP endpoint integration testing.
- **ESLint (`^8.57.0`)**: Static code analysis.

---

## 4. Database & Infrastructure

- **Database Engine**: PostgreSQL 15+ hosted on Supabase.
- **Extensions**: `pgcrypto` for UUID generation (`gen_random_uuid()`).
- **Database Migrations**: SQL files in `/migrations/` executed directly against PostgreSQL.

---

## 5. Dependency Vulnerability & Compatibility Status

During verification with `npm install` and `npm run build`:
1. **Node Engine Warning**: `@jukebox/server` specifies `node: "22.x"`. In environments running Node 24 (or Node 20), an `EBADENGINE` warning is emitted, which must be broadened to `>=20.0.0`.
2. **Next.js Font Issue**: In `packages/client/src/app/layout.tsx`, `next/font/google` attempts to load `Cormorant_Garamond` with an invalid weight specification (`["400", "500", "600", "700"]`), causing `TypeError: Cannot read properties of null (reading '1')` during `next build`.
3. **Outdated Dependencies**: Deprecations reported in `supertest@6.3.4`, `superagent@8.1.2`, `uuid@9.0.1`, and `eslint@8.57.1`.
