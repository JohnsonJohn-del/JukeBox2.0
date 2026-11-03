# 15. Missing Features & Gap Analysis

This document details the delta between the existing baseline codebase and the complete requirements specified in the user's Master Project Instruction.

---

## 1. Critical Requirement Gap: Native YouTube Music Video Mode

| Required Capability | Baseline Codebase Reality | Architectural Gap |
| :--- | :--- | :--- |
| **Native YouTube Music Video Mode** | Non-existent. Offscreen 1px audio iframe with static thumbnail image. | Needs responsive video viewport container with dynamic iframe injection/visibility toggle. |
| **Song-to-Video Counterpart Tracking** | Non-existent. Single `videoId` field across DB, API, and frontend. | Needs schema updates (`audio_video_id`, `music_video_id`, `has_video`), backend counterpart resolution, and state tracking. |
| **Host Audio/Video Toggle** | Non-existent. No UI button, action, or socket event. | Needs `Video Mode` switch button in host controls and footer player bar. |
| **Synchronized Mode Switching** | Non-existent. Only play/pause/seek events exist. | Needs `toggle_video_mode` socket event and `video_mode_changed` broadcast to all participants. |
| **Fallback for Unembeddable Videos** | Non-existent. Generic YouTube error logged to console. | Needs graceful detection of error codes (`101`, `150` embed restricted, regional block) and automatic fallback to audio mode with UI alert. |

---

## 2. Room Creation & Invitation Gap: Automatic QR Code System

| Required Capability | Baseline Codebase Reality | Architectural Gap |
| :--- | :--- | :--- |
| **Automatic QR Code Generation** | Completely missing. No QR code library installed. | Needs `qrcode.react` or canvas/SVG QR generator component on room creation and inside room. |
| **QR Code Download / Share** | Non-existent. | Needs download PNG/SVG action and modal sheet for mobile sharing. |
| **Frictionless Mobile Camera Join** | Non-existent. | Needs camera-friendly high-contrast QR code encoding `/join/{roomCode}` deep-link. |

---

## 3. Guest Access & Participation Gap

| Required Capability | Baseline Codebase Reality | Architectural Gap |
| :--- | :--- | :--- |
| **Anonymous / Guest Joining** | Broken. Strictly requires registered email/password account. | Needs guest JWT issuance, database schema foreign key relaxation, and guest session store. |
| **Persistent Guest Identity** | Non-existent. | Needs `guestId` stored in client `sessionStorage` / `localStorage` to survive page reloads without re-entering nickname. |
| **Host vs Guest Permissions** | Partially implemented. Server omits role check on playback sockets. | Needs server-enforced role checking on all playback mutators (`play`, `pause`, `seek`, `mode`). |

---

## 4. Real-Time Playback Synchronization Gap

| Required Capability | Baseline Codebase Reality | Architectural Gap |
| :--- | :--- | :--- |
| **NTP-like Clock Drift Correction** | Rudimentary threshold (`abs > 2s`). | Needs timestamp-based round-trip-time (RTT) compensation to calculate network latency and smoothly align playback. |
| **Late-Joiner Synchronization** | Handled via `request_sync`, but loses state on server restart. | Needs database-backed playback state recovery and authoritative current timestamp. |
| **Cross-Network Internet Sync** | Tested only locally (`localhost`). | Needs WebSocket transport fallbacks and ping/pong heartbeat health checks for cross-continent latency. |

---

## 5. Deployment & Infrastructure Gap

| Required Capability | Baseline Codebase Reality | Architectural Gap |
| :--- | :--- | :--- |
| **Vercel Production Deployment** | Fails build due to `next/font` crash. | Fix font configuration, verify clean static export and serverless route compatibility. |
| **Global WebSocket Tunneling** | Hardcoded to `http://localhost:4000`. | Configurable environment variables for public WebSocket endpoints, Cloudflare Tunnel support, and CORS origin matching. |
