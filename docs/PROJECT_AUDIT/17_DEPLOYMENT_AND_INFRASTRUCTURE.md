# 17. Deployment & Infrastructure Strategy

This document details the production hosting, cloud networking, and deployment topology required to make Jukebox globally accessible over the public internet.

---

## 1. Target Deployment Architecture

```mermaid
graph TD
    UserMumbai["User in Mumbai (Browser)"]
    UserLondon["User in London (Browser)"]
    VercelEdge["Vercel Edge Network<br/>Global CDN (Frontend)"]
    CFNetwork["Cloudflare Edge / Tunnel<br/>DDoS Protection, SSL, WAF"]
    Backend["Jukebox Backend Server<br/>Node.js / Express / Socket.IO"]
    Supabase["Supabase Cloud<br/>PostgreSQL 15+"]
    YouTubeCDN["Google / YouTube CDN<br/>Direct Video/Audio Delivery"]

    UserMumbai -->|HTTPS (Next.js SSR/Static)| VercelEdge
    UserLondon -->|HTTPS (Next.js SSR/Static)| VercelEdge
    UserMumbai <-->|WSS (WebSocket Sync)| CFNetwork
    UserLondon <-->|WSS (WebSocket Sync)| CFNetwork
    CFNetwork <--> Backend
    Backend --> Supabase
    UserMumbai -->|Direct Media Stream| YouTubeCDN
    UserLondon -->|Direct Media Stream| YouTubeCDN
```

---

## 2. Frontend Deployment on Vercel

The Next.js 14 client (`packages/client`) is engineered for deployment to Vercel:
1. **Root Directory**: `packages/client`
2. **Build Command**: `next build`
3. **Output Directory**: `.next`
4. **Environment Variables Configured in Vercel**:
   - `NEXT_PUBLIC_API_URL`: Public HTTPS URL of the backend API (e.g., `https://api.jukebox.example.com/api` or Cloudflare Tunnel URL).
   - `NEXT_PUBLIC_SOCKET_URL`: Public WSS URL of the Socket.IO server (e.g., `https://api.jukebox.example.com`).
   - `NEXT_PUBLIC_APP_URL`: Production domain of the Vercel app (e.g., `https://jukebox.example.com`).

---

## 3. Backend Deployment & Cloudflare Tunnel Architecture

Socket.IO requires long-lived stateful WebSocket connections (`ws://` / `wss://`). While serverless platforms (such as Vercel Functions) have execution time limits and cannot support persistent Socket.IO connections, the backend can be hosted on a persistent Node server (Render, Railway, VPS, or a self-hosted instance exposed via Cloudflare Tunnel).

### Cloudflare Architecture:
1. **Cloudflare Tunnel (`cloudflared`)**:
   - An encrypted outbound-only tunnel connecting the backend service to Cloudflare's global edge network without opening inbound firewall ports.
   - Provides free SSL termination, automated DNS configuration, and DDoS mitigation.
2. **WebSocket Configuration**:
   - Cloudflare natively proxies WebSockets over HTTPS/WSS on port 443.
   - Ensure "WebSockets" toggle is enabled in Cloudflare Network dashboard settings.
3. **Session Affinity (Sticky Sessions)**:
   - For multi-instance deployments, Cloudflare session affinity ensures client polling requests reach the same server worker before upgrading to WebSockets.

---

## 4. Database Setup & Supabase Configuration

1. Create a Supabase project.
2. Execute the 4 SQL scripts in `/migrations/` using the Supabase SQL Editor.
3. Configure PostgreSQL connection string and service keys in the backend `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `DATABASE_URL`
