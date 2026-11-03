# 11. Module Dependency Map & Architecture Diagrams

This document maps the architectural dependencies and data flows between modules across both client and server packages.

---

## 1. Client-Side Module Dependency Map

```mermaid
graph TD
    subgraph AppRouter["Next.js Pages (src/app)"]
        Landing["page.tsx"]
        Room["room/[id]/page.tsx"]
        Join["join/[code]/page.tsx"]
        Login["login/page.tsx"]
        Signup["signup/page.tsx"]
    end

    subgraph Presentation["Components (src/components)"]
        Hero["landing/Hero.tsx"]
        CreateCard["landing/CreateRoomCard.tsx"]
        JoinCard["landing/JoinRoomCard.tsx"]
        PlayerComp["room/Player.tsx"]
        FooterControls["room/FooterPlayerControls.tsx"]
        QueueComp["room/Queue.tsx"]
        SearchComp["room/SearchBar.tsx"]
        MemberList["room/MemberList.tsx"]
        HostControls["room/HostControls.tsx"]
        InviteBtn["room/InviteButton.tsx"]
    end

    subgraph Hooks["Custom Hooks (src/hooks)"]
        usePlayer["usePlayer.ts"]
        useRoom["useRoom.ts"]
        useQueue["useQueue.ts"]
        useSocket["useSocket.ts"]
        useTheme["useThemeColors.ts"]
    end

    subgraph State["Zustand Stores (src/store)"]
        authStore["authStore.ts"]
        roomStore["roomStore.ts"]
        queueStore["queueStore.ts"]
        playerStore["playerStore.ts"]
        themeStore["themeStore.ts"]
    end

    subgraph Services["API Services (src/services)"]
        apiClient["api.ts (Fetch Wrapper)"]
        authService["auth.ts"]
        roomService["room.ts"]
        searchService["search.ts"]
    end

    subgraph RealTime["Sockets (src/sockets)"]
        socketClient["index.ts (socket.io-client)"]
        socketEvents["events.ts"]
    end

    Landing --> Hero
    Landing --> CreateCard
    Landing --> JoinCard
    Room --> PlayerComp
    Room --> FooterControls
    Room --> QueueComp
    Room --> SearchComp
    Room --> MemberList
    Room --> InviteBtn
    Room --> HostControls

    PlayerComp --> usePlayer
    PlayerComp --> useSocket
    PlayerComp --> useTheme
    QueueComp --> useQueue
    Room --> useRoom

    usePlayer --> playerStore
    useRoom --> roomStore
    useQueue --> queueStore
    useSocket --> socketClient
    useTheme --> themeStore

    CreateCard --> roomService
    JoinCard --> roomService
    SearchComp --> searchService
    authService --> apiClient
    roomService --> apiClient
    searchService --> apiClient

    socketClient --> socketEvents
```

---

## 2. Server-Side Module Dependency Map

```mermaid
graph TD
    subgraph ServerEntry["Server Entry (src)"]
        Index["index.ts"]
        App["app.ts"]
    end

    subgraph HTTPRoutes["Express Routes (src/routes)"]
        RoutesIndex["routes/index.ts"]
        AuthRoutes["auth.routes.ts"]
        RoomRoutes["room.routes.ts"]
        QueueRoutes["queue.routes.ts"]
        SearchRoutes["search.routes.ts"]
    end

    subgraph Controllers["Controllers (src/controllers)"]
        AuthController["auth.controller.ts"]
        RoomController["room.controller.ts"]
        QueueController["queue.controller.ts"]
    end

    subgraph BusinessLogic["Services (src/services)"]
        AuthService["auth.service.ts"]
        RoomService["room.service.ts"]
        QueueService["queue.service.ts"]
        SearchService["search.service.ts"]
    end

    subgraph Sockets["Socket Handlers (src/sockets)"]
        SocketIndex["sockets/index.ts"]
        RoomSocket["room.socket.ts"]
        PlaybackSocket["playback.socket.ts"]
        QueueSocket["queue.socket.ts"]
    end

    subgraph Database["Data Layer (src/config)"]
        DBClient["database.ts (SupabaseClient)"]
        Config["config/index.ts"]
    end

    Index --> App
    Index --> SocketIndex
    App --> RoutesIndex
    RoutesIndex --> AuthRoutes
    RoutesIndex --> RoomRoutes
    RoutesIndex --> QueueRoutes
    RoutesIndex --> SearchRoutes

    AuthRoutes --> AuthController
    RoomRoutes --> RoomController
    QueueRoutes --> QueueController

    AuthController --> AuthService
    RoomController --> RoomService
    QueueController --> QueueService

    SocketIndex --> RoomSocket
    SocketIndex --> PlaybackSocket
    SocketIndex --> QueueSocket

    PlaybackSocket --> QueueService
    RoomSocket --> RoomService
    QueueSocket --> QueueService

    AuthService --> DBClient
    RoomService --> DBClient
    QueueService --> DBClient
    DBClient --> Config
```

---

## 3. Real-Time Data Flow: Media Playback Event Cycle

```mermaid
sequenceDiagram
    autonumber
    actor Host as Host (Client A)
    participant SocketServer as Socket.IO Server
    participant StateMap as Server roomPlaybackStates
    actor Guest as Remote Guest (Client B)
    participant YTPlayer as Guest YouTube Player

    Host->>SocketServer: emit('play', { roomId, position: 45.2 })
    Note over SocketServer: Verify host authorization (Currently Missing!)
    SocketServer->>StateMap: Update state (playbackState='playing', startTime=now)
    SocketServer->>Guest: broadcast.to(roomId).emit('playback_state', { state: 'playing', position: 45.2 })
    Guest->>YTPlayer: seekTo(45.2), playVideo()
    Note over Guest: Drift calculation occurs: if |localTime - serverTime| > 2s, seekTo()
```
