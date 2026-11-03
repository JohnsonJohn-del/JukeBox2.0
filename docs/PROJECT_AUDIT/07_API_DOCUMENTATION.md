# 07. REST API & WebSocket Protocol Documentation

## 1. REST API Endpoints

All REST routes are prefixed with `/api`. Standard responses follow the structure:
`{ "success": boolean, "data"?: any, "error"?: { "message": string, "code": string } }`.

### Authentication Endpoints (`/api/auth`)

#### 1. Register User
- **Method**: `POST /api/auth/register`
- **Auth**: None
- **Body**:
  ```json
  { "username": "string (3-50 chars)", "email": "valid email", "password": "string (>=8 chars)" }
  ```
- **Success (201 Created)**:
  ```json
  { "success": true, "data": { "user": { "id": "uuid", "username": "...", "email": "..." }, "token": "jwt..." } }
  ```
- **Error Codes**: `VALIDATION_ERROR` (400), `DUPLICATE_CREDENTIALS` (409), `USER_CREATE_FAILED` (500).

#### 2. Login User
- **Method**: `POST /api/auth/login`
- **Auth**: None
- **Body**:
  ```json
  { "email": "valid email", "password": "string" }
  ```
- **Success (200 OK)**:
  ```json
  { "success": true, "data": { "user": { "id": "uuid", "username": "...", "email": "..." }, "token": "jwt..." } }
  ```
- **Error Codes**: `VALIDATION_ERROR` (400), `INVALID_CREDENTIALS` (401).

#### 3. Current User Profile
- **Method**: `GET /api/auth/me`
- **Auth**: `Authorization: Bearer <token>`
- **Success (200 OK)**:
  ```json
  { "success": true, "data": { "user": { "id": "uuid", "username": "...", "email": "..." } } }
  ```
- **Error Codes**: `AUTH_REQUIRED` (401), `TOKEN_INVALID` (401), `USER_NOT_FOUND` (404).

---

### Room Endpoints (`/api/rooms`)

#### 1. Create Room
- **Method**: `POST /api/rooms`
- **Auth**: `Authorization: Bearer <token>`
- **Body**: `{ "name"?: "string (max 100)" }`
- **Success (201 Created)**:
  ```json
  { "success": true, "data": { "room": { "id": "uuid", "roomCode": "ABC123", "hostId": "uuid" }, "member": { ... } } }
  ```

#### 2. Join Room
- **Method**: `POST /api/rooms/join`
- **Auth**: `Authorization: Bearer <token>` *(CRITICAL DEFECT: Blocks unauthenticated guests)*
- **Body**: `{ "roomCode": "ABC123", "nickname": "string (2-50 chars)" }`
- **Success (200 OK)**:
  ```json
  { "success": true, "data": { "room": { ... }, "member": { ... } } }
  ```
- **Error Codes**: `ROOM_NOT_FOUND` (404), `ROOM_INACTIVE` (410), `ALREADY_MEMBER` (409).

#### 3. Get Active Rooms
- **Method**: `GET /api/rooms`
- **Auth**: `Authorization: Bearer <token>`
- **Success (200 OK)**: Array of rooms where user is currently a member.

#### 4. Get Room by ID
- **Method**: `GET /api/rooms/:id`
- **Auth**: None
- **Success (200 OK)**:
  ```json
  { "success": true, "data": { "room": { ... }, "members": [...], "queue": [...] } }
  ```

#### 5. Leave Room
- **Method**: `POST /api/rooms/:id/leave`
- **Auth**: `Authorization: Bearer <token>`

#### 6. Transfer Host
- **Method**: `POST /api/rooms/:id/transfer`
- **Auth**: `Authorization: Bearer <token>`
- **Body**: `{ "newHostId": "uuid" }`

#### 7. End Room
- **Method**: `POST /api/rooms/:id/end`
- **Auth**: `Authorization: Bearer <token>` (Host only)

---

### Queue Endpoints (`/api/rooms/:roomId/queue`)

#### 1. Get Queue
- **Method**: `GET /api/rooms/:roomId/queue`
- **Auth**: None
- **Success (200 OK)**: `{ "success": true, "data": { "queue": [...] } }`

#### 2. Add Song
- **Method**: `POST /api/rooms/:roomId/queue`
- **Auth**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  { "videoId": "string", "title": "string", "artist": "string", "duration": 180, "thumbnail": "url" }
  ```
- **Error Codes**: `DUPLICATE_SONG` (409), `COOLDOWN_ACTIVE` (429), `MAX_SONGS_REACHED` (429).

#### 3. Remove Song
- **Method**: `DELETE /api/rooms/:roomId/queue/:itemId`
- **Auth**: `Authorization: Bearer <token>` (Must be item creator or room host)

#### 4. Reorder Queue
- **Method**: `PUT /api/rooms/:roomId/queue/reorder`
- **Auth**: `Authorization: Bearer <token>` (Host only)
- **Body**: `{ "itemId": "uuid", "newIndex": 0 }`

---

### Search Endpoints (`/api/search`)

#### 1. Search Songs
- **Method**: `GET /api/search?q=query`
- **Auth**: None
- **Success (200 OK)**:
  ```json
  { "success": true, "data": { "results": [{ "videoId": "...", "title": "...", "artist": "...", "duration": 210, "thumbnails": { ... } }] } }
  ```

---

## 2. WebSocket Protocol (Socket.IO)

Clients connect to `ws://localhost:4000/socket.io/?token=<jwt>`.

### Client to Server Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `create_room` | `{ name?: string }` | Requests creation of a new room over socket |
| `join_room` | `{ roomCode: string, nickname: string }` | Enters socket room channel by room code |
| `rejoin_room` | `{ roomId: string }` | Re-subscribes socket after temporary disconnection |
| `leave_room` | `{ roomId: string }` | Leaves room and broadcasts departure |
| `transfer_host`| `{ roomId: string, newHostId: string }` | Transfers host role to another participant |
| `play` | `{ roomId: string, position?: number }` | Resumes playback at specified position |
| `pause` | `{ roomId: string, position: number }` | Pauses playback at specified position |
| `seek` | `{ roomId: string, position: number }` | Changes playback position |
| `next_track` | `{ roomId: string }` | Advances to the next track in queue |
| `add_song` | `{ roomId: string, videoId, title, ... }` | Enqueues a song into room playlist |
| `remove_song` | `{ roomId: string, itemId: string }` | Deletes a song from the queue |
| `reorder_queue`| `{ roomId: string, itemId, newIndex }` | Changes song position in queue |
| `request_sync` | `{ roomId: string }` | Requests authoritative server timestamp & state |

### Server to Client Events

| Event Name | Payload | Broadcast Scope |
| :--- | :--- | :--- |
| `room_created` | `{ roomId: string, roomCode: string }` | Sender socket only |
| `room_joined` | `{ roomId, roomCode, members, queue }` | Sender socket only |
| `user_joined` | `{ userId: string, nickname: string }` | Room (except sender) |
| `user_left` | `{ userId: string, nickname: string }` | Room (except sender) |
| `host_changed` | `{ newHostId: string }` | Room (all members) |
| `playback_state`| `{ state: 'playing'\|'paused', position, track }` | Room (except sender on play/pause) |
| `seeked` | `{ position: number }` | Room (all members) |
| `track_changed`| `{ track: QueueItem \| null }` | Room (all members) |
| `queue_updated`| `{ queue: QueueItem[] }` | Room (all members) |
| `sync_state` | `{ serverTimestamp, playbackState, position, track }` | Requesting socket only |
| `room_closed` | `{}` | Room (all members) |
| `error` | `{ message: string, code?: string }` | Sender socket only |
