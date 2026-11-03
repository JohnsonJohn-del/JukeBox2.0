# 16. Performance, Scalability & Load Analysis

This document evaluates the system's performance characteristics, concurrency limits, and scalability bottlenecks across distributed geographical environments.

---

## 1. Concurrency Analysis & Single-Instance Limits

In its current baseline architecture, `packages/server` runs as a single-process Node.js instance with an in-memory `Map<string, RoomPlaybackState>` for playback tracking and an in-memory `userCooldowns` map.

### 1. Connection Limits
- **Node.js Socket.IO**: A single Node.js process comfortably handles ~5,000–10,000 concurrent idle WebSocket connections depending on memory limits.
- **Active Rooms**: If each room contains an average of 10 participants, a single server instance can theoretically support ~500–1,000 active rooms.
- **Bottleneck**: Because state is kept in Node.js RAM (`roomPlaybackStates`), the backend cannot scale horizontally behind a load balancer without sticky sessions or a Redis adapter (`@socket.io/redis-adapter`).

### 2. Event Throughput & Broadcast Overhead
- When a host pauses or seeks, an event is emitted to all room participants:
  $$\text{Outgoing Messages} = N - 1 \quad (N = \text{room size})$$
- For a room of 100 participants, 1 seek command generates 99 socket emissions. At typical sizes (5-20 friends), message overhead is negligible (<1 KB payload per event).

---

## 2. Media Streaming vs Control Latency

A common misconception in media synchronization platforms is that the application server streams the video bytes.
- **Client-Direct Streaming**: Each participant's browser embeds the official YouTube IFrame player. Video and audio chunks are fetched directly from Google's global Content Delivery Network (CDN) edge servers closest to each participant (e.g., Mumbai, London, Chennai).
- **Server Responsibility**: The Jukebox server only transmits lightweight control events (play, pause, seek position, track ID, video mode). Control packet sizes are approximately 150–250 bytes.

---

## 3. Network Latency & Drift Compensation Model

Participants situated across different continents experience varying round-trip times (RTT) to the central server:
- Participant in Mumbai: ~30ms RTT.
- Participant in London: ~140ms RTT.

### Existing Drift Logic:
```typescript
const drift = Math.abs(localTime - data.playbackPosition);
if (drift > 2) seekTo(data.playbackPosition);
```
- **Problem**: If network latency jitter spikes, or if `drift` fluctuates around 2.1 seconds, the YouTube player repeatedly calls `seekTo()`, causing audio buffering, micro-stutters, and broken playback experience.

### Recommended Drift Smoothing Model:
1. **Network RTT Estimation**: Ping/pong round-trip calculation when establishing socket connection:
   $$\text{OneWayDelay} = \frac{\text{RTT}}{2}$$
2. **Server Time Offsetting**:
   $$\text{TargetPosition} = \text{ServerPosition} + \text{OneWayDelay}$$
3. **Multi-Tier Correction**:
   - **Drift < 0.5s**: No correction (imperceptible difference to human ear).
   - **0.5s < Drift < 3s**: Micro-speed adjustment (`playbackRate = 1.05` or `0.95`) for 2-3 seconds to smoothly converge without audio pause.
   - **Drift > 3s**: Hard `seekTo(TargetPosition)` (used for initial sync or manual host seeks).
