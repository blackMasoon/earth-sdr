# WebSDR Atlas 🌍

A world-wide WebSDR browser that aggregates all available WebSDR stations with:
- Interactive map (OpenStreetMap) for station selection
- Alternative list view
- Estimated propagation range visualization (frequency-dependent circles)
- Unified waterfall display with smooth zoom
- Frequency slider (mouse + keyboard control)
- Saved programs (named frequencies with colors)
- Minimalistic, intuitive dark UI

## Project Structure

```
/websdr-atlas
  /apps
    /frontend   # React + Vite + TailwindCSS
    /backend    # NestJS + Prisma
  /packages
    /shared     # Shared TypeScript types and utilities
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Installation

```bash
# Install pnpm if not installed
npm install -g pnpm

# Install dependencies
pnpm install

# Setup backend database
cd apps/backend
cp .env.example .env
npx prisma migrate dev
cd ../..
```

### Development

```bash
# Start all services (from root)
pnpm dev

# Or start individually:
# Backend (http://localhost:3001)
cd apps/backend && pnpm dev

# Frontend (http://localhost:5173)
cd apps/frontend && pnpm dev
```

### Building

```bash
pnpm build
```

## Features

### Implemented ✅

- **Monorepo setup** - pnpm workspaces + turbo
- **Shared types** - TypeScript types for stations, programs, propagation
- **Backend API**
  - Stations module (GET /api/stations, GET /api/stations/:id)
  - Crawler module with seed data
  - Propagation module (simple model)
  - Prisma ORM with SQLite
- **Frontend**
  - Map view with Leaflet + OpenStreetMap
  - List view for stations
  - Station details panel
  - Waterfall display (MVP with test noise generator)
  - Frequency cursor with keyboard navigation
  - Saved programs (localStorage)
  - Propagation rings visualization

### Roadmap 🚀

- [ ] Real WebSDR integration
- [ ] Audio streaming
- [ ] User authentication
- [ ] Cloud sync for programs
- [ ] Advanced propagation model (VOACAP integration)
- [ ] Station status monitoring

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Leaflet, Zustand
- **Backend**: NestJS, Prisma, SQLite
- **Shared**: TypeScript types and utilities

## License

MIT - Open source project

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.
