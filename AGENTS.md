# SonicPro Client + Go API

React SPA frontend with a Go/Gin backend for the ultrasonic impregnation diploma project.

## Tech Stack

- **Package manager**: prefer `pnpm`
- **Frontend**: React 18 + React Router 6 + TypeScript + Vite + TailwindCSS 3
- **Backend**: Go + Gin + Gorm, entry point `server/main.go`
- **Database**: PostgreSQL, configured in `server/main.go`
- **UI**: Radix UI + TailwindCSS + Lucide React icons
- **Testing/type checks**: Vitest and TypeScript

The old TypeScript Express server has been removed from the active app. Do not add new Express routes. API changes belong in `server/main.go` or new Go files under `server/`.

## Project Structure

```text
client/
  components/
  lib/api.ts          # shared frontend API client, JWT/session helpers, WS URL builder
  pages/
  App.tsx            # routes and role guards

server/
  main.go            # Go API, auth, role routes, WebSocket control
  go.mod
  go.sum
```

## API Integration

- Frontend dev server runs on `http://localhost:5173`.
- Go API runs on `http://localhost:8080`.
- Vite proxies `/api` and WebSocket upgrades to `http://localhost:8080`.
- Protected REST requests use `Authorization: Bearer <token>`.
- Browser WebSocket cannot send custom `Authorization` headers, so `client/lib/api.ts` appends `?token=<jwt>` for `/api/operator/ws`; the Go auth middleware accepts this query token.
- On HTTP `401`, the frontend clears the session and redirects to `/login`.

## Roles

JWT payload field `Role` controls navigation:

- `admin`: all sections
- `director`: manager pages
- `technologist`: technology pages
- `operator`: operator pages

## Development Commands

Run backend and frontend in separate terminals:

```bash
cd server
go run main.go
```

```bash
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm build
pnpm test
```

## Backend Notes

The default database DSN in `server/main.go` is:

```text
host=localhost user=postgres password=postgres dbname=userdb port=5432 sslmode=disable
```

On startup the server auto-migrates models and creates an admin user if no admin exists. Defaults:

```text
admin / admin123
```

These can be overridden with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

## Adding Features

- Add frontend API calls through `client/lib/api.ts` helpers.
- Add protected backend endpoints in Go and register them under `/api/...`.
- Keep frontend mock data out of production flows; use local placeholder state only for unsaved form drafts.
- For new WebSocket features, avoid relying on custom browser headers during upgrade.
