# 03. Complete Directory Structure & File Map

## 1. Monorepo File Tree

```
Jukebox/
├── .env.example                     # Root environment configuration template
├── .gitignore                       # Git ignore definitions (node_modules, dist, .next, etc.)
├── package-lock.json                # Resolved dependency lockfile
├── package.json                     # Root monorepo configuration with npm workspaces
├── migrations/                      # PostgreSQL database migration scripts
│   ├── 001_create_users.sql         # Users table schema & triggers
│   ├── 002_create_rooms.sql         # Rooms table schema & triggers
│   ├── 003_create_room_members.sql  # Room membership schema & deactivation trigger
│   └── 004_create_queue_items.sql   # Queue items schema & position index
├── packages/
│   ├── client/                      # Frontend Application (Next.js 14)
│   │   ├── .env.example             # Frontend environment variables template
│   │   ├── next-env.d.ts            # Next.js TypeScript declarations
│   │   ├── next.config.js           # Next.js compiler & domain configuration
│   │   ├── package.json             # Frontend package manifest & dependencies
│   │   ├── postcss.config.js        # PostCSS plugin configurations
│   │   ├── tailwind.config.ts       # Tailwind theme colors, fonts, and animation tokens
│   │   ├── tsconfig.json            # Client TypeScript compiler options
│   │   └── src/
│   │       ├── app/                 # Next.js App Router routes & layouts
│   │       │   ├── layout.tsx       # Root layout, Google fonts, Navbar wrapper
│   │       │   ├── page.tsx         # Landing page (Hero, active rooms, entry cards)
│   │       │   ├── join/
│   │       │   │   └── [code]/
│   │       │   │       └── page.tsx # Join room via invitation code or URL
│   │       │   ├── login/
│   │       │   │   └── page.tsx     # User sign-in page
│   │       │   ├── room/
│   │       │   │   └── [id]/
│   │       │   │       └── page.tsx # Main music room dashboard & listening experience
│   │       │   └── signup/
│   │       │       └── page.tsx     # User account registration page
│   │       ├── components/          # React presentation & container components
│   │       │   ├── auth/            # Authentication forms (LoginForm, SignupForm)
│   │       │   ├── landing/         # Landing UI (Hero, CreateRoomCard, JoinRoomCard)
│   │       │   ├── layout/          # Global layout (Navbar, Providers)
│   │       │   ├── room/            # Room-specific UI modules:
│   │       │   │   ├── FooterPlayerControls.tsx  # Bottom player bar controls
│   │       │   │   ├── HostControls.tsx          # End room & transfer host buttons
│   │       │   │   ├── InviteButton.tsx          # Room code copy/share button
│   │       │   │   ├── MemberList.tsx            # Active participants sidebar list
│   │       │   │   ├── NowPlaying.tsx            # Compact mobile header banner
│   │       │   │   ├── Player.tsx                # Visual player with arch neon frame
│   │       │   │   ├── Queue.tsx                 # Drag/reorder playlist queue
│   │       │   │   ├── SearchBar.tsx             # Live autocomplete song search
│   │       │   │   └── index.ts                  # Barrel export file
│   │       │   └── ui/              # Reusable UI primitives (Button, Card, Dialog, etc.)
│   │       ├── hooks/               # Custom React hooks:
│   │       │   ├── usePlayer.ts     # YouTube IFrame player initialization & controls
│   │       │   ├── useQueue.ts      # Queue mutation helpers & cooldown tracking
│   │       │   ├── useRoom.ts       # Room lifecycle and socket events binding
│   │       │   ├── useSocket.ts     # Socket.IO connection manager & state
│   │       │   └── useThemeColors.ts# Vibrant color extraction from album art
│   │       ├── lib/                 # Utilities and constants:
│   │       │   ├── constants.ts     # API and WebSocket URLs from env vars
│   │       │   └── utils.ts         # Formatting, thumbnail URL resolver, Tailwind merge
│   │       ├── services/            # Client-side API service wrappers:
│   │       │   ├── api.ts           # Centralized Fetch API client with auth headers
│   │       │   ├── auth.ts          # Auth API calls (login, register, me)
│   │       │   ├── room.ts          # Room API calls (create, join, get, leave)
│   │       │   └── search.ts        # Search API calls (query songs)
│   │       ├── sockets/             # Socket.IO client setup:
│   │       │   ├── events.ts        # Constants for socket event names
│   │       │   └── index.ts         # Socket singleton instance and connection helper
│   │       ├── store/               # Zustand state stores:
│   │       │   ├── authStore.ts     # Authentication session state
│   │       │   ├── playerStore.ts   # Playback state, current time, duration
│   │       │   ├── queueStore.ts    # Current queue items and active track
│   │       │   ├── roomStore.ts     # Room details, host status, members list
│   │       │   └── themeStore.ts    # Extracted colors & dark/light theme state
│   │       ├── styles/              # Global CSS & neon custom properties
│   │       │   └── globals.css      # Custom animations, jukebox styling classes
│   │       └── types/               # Client TypeScript interfaces and models
│   │           └── index.ts         # User, Room, QueueItem, SearchResult types
│   │
│   └── server/                      # Backend Application (Express + Socket.IO)
│       ├── .env.example             # Server environment variables template
│       ├── .eslintrc.js             # Server ESLint configuration
│       ├── jest.config.js           # Jest unit test configuration
│       ├── package.json             # Server manifest & dependencies
│       ├── tsconfig.json            # Server TypeScript compiler options
│       ├── src/
│       │   ├── app.ts               # Express application initialization & middleware
│       │   ├── index.ts             # HTTP server entrypoint & socket bootstrap
│       │   ├── config/              # Central configuration:
│       │   │   ├── database.ts      # Supabase client instantiation
│       │   │   └── index.ts         # Environment variable parsing with defaults
│       │   ├── controllers/         # Express request handlers:
│       │   │   ├── auth.controller.ts  # Register, login, getMe controllers
│       │   │   ├── queue.controller.ts # Get queue, add/remove/reorder controllers
│       │   │   └── room.controller.ts  # Room lifecycle controllers
│       │   ├── middleware/          # Express middleware:
│       │   │   ├── auth.middleware.ts  # JWT verification (authenticate, optionalAuth)
│       │   │   ├── error.middleware.ts # Global error handler & AppError class
│       │   │   └── validate.middleware.ts # Zod schema validation middleware
│       │   ├── routes/              # Express API route declarations:
│       │   │   ├── auth.routes.ts   # /api/auth routes
│       │   │   ├── queue.routes.ts  # /api/rooms/:roomId/queue routes
│       │   │   ├── room.routes.ts   # /api/rooms routes
│       │   │   ├── search.routes.ts # /api/search routes
│       │   │   └── index.ts         # Central route router mounting
│       │   ├── services/            # Core business logic:
│       │   │   ├── auth.service.ts  # User registration, bcrypt verification, JWT
│       │   │   ├── queue.service.ts # Queue CRUD, position sorting, cooldown check
│       │   │   ├── room.service.ts  # Room generation, membership, host transfer
│       │   │   └── search.service.ts# YT Music API proxy & YouTube HTML scraper
│       │   ├── sockets/             # Real-time event handlers:
│       │   │   ├── index.ts         # Socket.IO setup, auth middleware, connection
│       │   │   ├── playback.socket.ts # Play, pause, seek, sync, skip handlers
│       │   │   ├── queue.socket.ts  # Add, remove, reorder queue events
│       │   │   └── room.socket.ts   # Create, join, leave, transfer room events
│       │   ├── types/               # Server TypeScript interfaces:
│       │   │   ├── index.ts         # Domain entities (User, Room, QueueItem)
│       │   │   └── socket.ts        # Typed Socket.IO event payloads
│       │   ├── utils/               # Helper utilities:
│       │   │   ├── clientMapper.ts  # Snake_case to camelCase entity mappers
│       │   │   ├── helpers.ts       # API response formatting (formatResponse/Error)
│       │   │   ├── jwt.ts           # Token sign & verify functions
│       │   │   └── roomCode.ts      # 6-character room code generator
│       │   └── validators/          # Zod schema definitions:
│       │       ├── auth.validator.ts# Register and login schemas
│       │       ├── queue.validator.ts# Add song and reorder schemas
│       │       └── room.validator.ts# Room creation and joining schemas
│       └── tests/                   # Automated tests:
│           ├── auth.test.ts         # Auth routes integration tests
│           └── room.test.ts         # Room routes integration tests
└── docs/
    └── PROJECT_AUDIT/               # Complete reverse engineering audit documentation
```
