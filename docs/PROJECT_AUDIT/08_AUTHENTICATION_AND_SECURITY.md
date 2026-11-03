# 08. Authentication, Authorization & Security Audit

## 1. Authentication Mechanisms

The system employs stateless JSON Web Tokens (JWT) signed with HMAC-SHA256 (`jsonwebtoken`):
- **Signing Key**: Stored in `config.jwt.secret` (defaults to dev fallback if `JWT_SECRET` is unset).
- **Token Lifespan**: Defined via `config.jwt.expiresIn` (defaults to `7d`).
- **Payload Schema**:
  ```typescript
  interface JwtPayload {
    userId: string;
    role: 'user' | 'guest';
    roomId?: string;
    iat: number;
    exp: number;
  }
  ```
- **Password Protection**: Handled using `bcryptjs` with 12 salt rounds during registration and verified via `bcrypt.compare` on login.

---

## 2. Critical Security Vulnerabilities & Architectural Gaps

### 1. Inability for Guests to Participate Legally
- **Finding**: The server exposes an `optionalAuth` middleware in `src/middleware/auth.middleware.ts`, but in `src/routes/room.routes.ts`:
  ```typescript
  router.post('/join', authenticate, validate(joinRoomSchema), roomController.joinRoom);
  ```
  And in `src/sockets/index.ts`:
  ```typescript
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    ...
  });
  ```
- **Consequence**: Unauthenticated guests cannot join any room or connect via WebSockets. They receive HTTP 401 and Socket connection rejection errors.
- **Remediation**: Implement an anonymous guest authentication endpoint or allow `optionalAuth` on join to issue ephemeral guest JWTs (`role: 'guest'`) with client-held temporary session identifiers.

### 2. Missing Host Authorization on Playback Sockets
- **Finding**: In `packages/server/src/sockets/playback.socket.ts`:
  - `socket.on('play')`: Does not check if `socket.data.userId === room.host_id`.
  - `socket.on('pause')`: Does not check if `socket.data.userId === room.host_id`.
  - `socket.on('seek')`: Does not check if `socket.data.userId === room.host_id`.
- **Consequence**: Any participant or malicious guest can emit `pause` or `seek` socket events and hijack the playback state of the entire room.
- **Remediation**: The server must verify that the socket's `userId` matches the room's `host_id` before committing playback state changes or broadcasting to other participants.

### 3. Room Code Enumeration Risk
- **Finding**: Room codes are 6 characters chosen from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 characters, $32^6 \approx 1.07 \times 10^9$ possibilities).
- **Consequence**: While $10^9$ entropy is reasonable, `GET /api/rooms/:id` and socket attempts are not subject to room-level rate limiting or brute-force lockouts. An attacker can scan room codes.
- **Remediation**: Add IP/session rate limiting specifically on room discovery attempts and validate active room membership before exposing internal state.

### 4. Absence of Room Access Protection (PINs / Passwords)
- **Finding**: Rooms are completely open if the room code is known. There is no host option to require a passcode or approval gate for remote attendees.

### 5. In-Memory Rate Limiting Bottleneck
- **Finding**: `express-rate-limit` is configured in-memory with a default limit of 100 requests per 15 minutes.
- **Consequence**: If multiple server replicas or serverless workers are deployed, rate limit states are partitioned and ineffective.
