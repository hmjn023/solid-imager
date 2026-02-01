# Technology Stack

## Core
- **Language**: TypeScript
- **Runtime**: Bun (Server & Tooling)

## Frontend (Web & Desktop Client)
- **Framework**: SolidStart (SolidJS)
- **Routing**: TanStack Router (Planned/Transitioning)
- **State Management**: TanStack Query
- **Form Management**: TanStack Form
- **UI Components**: Kobalte (Headless), Tailwind CSS
- **Desktop Shell**: Tauri v2 (Planned for Client)

## Backend (Server)
- **API Framework**: ElysiaJS
- **RPC Framework**: oRPC (Type-safe contract)
- **SSR**: SolidStart (Server-Side Rendering)

## Database & ORM
- **ORM**: Drizzle ORM
- **Database (Server)**: PostgreSQL
- **Database (Client/Local)**: PGlite (WASM-based Postgres, Embedded)
- **ID Strategy**: UUID (v4)

## AI & Data Processing
- **AI Backend**: FastAPI (Python)
- **Image Processing**: Sharp (Node.js)

## Testing & Quality
- **Test Runner**: Vitest (Unit/Integration)
- **E2E Testing**: Playwright
- **Linter/Formatter**: Biome

## Architecture Style
- **Pattern**: Clean Architecture / Hexagonal Architecture
- **Structure**: Monorepo (Current: apps/server, packages/core, Planned: apps/client)
