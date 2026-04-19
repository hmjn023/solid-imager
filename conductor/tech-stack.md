# Technology Stack

## Core
- **Language**: TypeScript
- **Runtime**: Bun (Server & Tooling)

## Frontend (Web & Desktop Client)
- **Framework**: TanStack Start (SolidJS)
- **Routing**: TanStack Router (file-based)
- **State Management**: TanStack Query
- **Form Management**: TanStack Form
- **UI Components**: Kobalte (Headless), Tailwind CSS
- **Desktop Shell**: Tauri v2

## Backend (Server)
- **Server**: Nitro
- **RPC Framework**: oRPC (Type-safe contract, Fetch handler)
- **SSR**: TanStack Start (Server-Side Rendering)

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
- **Structure**: Monorepo (apps/server, apps/tauri, apps/cli, apps/xtracter, packages/core, packages/ui)
