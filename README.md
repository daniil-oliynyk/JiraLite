<p align="center">
  <img src="public/branding/logo.png" alt="Taska logo" width="360" />
</p>

# Taska ✨

Taska is a lightweight, dark-mode, kanban-first project management app inspired by Jira/ClickUp workflows, built for teams that want clear ownership, scoped visibility, and fast task execution.

## 📸 Screenshots

### 🖥️ Workspace Dashboard

<img src="public/screenshots/workspace-dashboard.png" alt="Taska Workspace Dashboard" width="880" />

### 📋 Project Board

<img src="public/screenshots/project-board.png" alt="Taska Project Board" width="880" />

## ✨ Features

- Email/password authentication with role-based access for `MANAGER` and `MEMBER` users.
- Team Spaces with manager ownership and membership-based access control.
- Project visibility modes: `TEAM_VISIBLE` and `MEMBERS_ONLY`.
- Project-level membership rules and role-aware permissions.
- Task management with assignee, start/end dates, optional due date, estimation, and priority.
- Kanban board with drag-and-drop status movement using `@dnd-kit`.
- Task comments and activity feed support.
- Workspace dashboard with KPIs, charts, recent tasks, and Team Space summaries.
- Manager flow for creating member accounts with temporary passwords and forced first-login reset.
- Outbox event table included for future async/realtime/webhook expansion.

## 🧰 Tech Stack

- `Next.js` (App Router)
- `React` + `TypeScript`
- `Prisma` + `PostgreSQL`
- `Tailwind CSS`
- `@dnd-kit` (drag-and-drop)
- `Recharts` (dashboard charts)
- `zod` (input validation)

## 🚀 Getting Started

### 1) Install dependencies

Use your preferred package manager (examples below):

```bash
bun install
```

### 2) Configure environment variables

Create a `.env` file in the project root and add at least:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME"
```

Make sure your PostgreSQL server is running and reachable from this URL.

### 3) Generate Prisma client

```bash
bun run prisma:generate
```

### 4) Apply schema to your database

```bash
bun run prisma:push
```

If you prefer migrations during development:

```bash
bun run prisma:migrate
```

### 5) Start development server

```bash
bun run dev
```

Open `http://localhost:3000`.

## 🛠️ Available Scripts

- `dev` — run Next.js in development mode.
- `build` — create production build.
- `start` — run production server.
- `lint` — run lint checks.
- `prisma:generate` — generate Prisma client.
- `prisma:migrate` — run Prisma migrations in dev.
- `prisma:push` — push Prisma schema to database.

## 🗂️ Project Structure

```text
src/
  app/                # App Router pages and server actions
  components/         # UI and domain components (dashboard, kanban, etc.)
  lib/                # Auth, permissions, queries, Prisma client, utilities
prisma/               # Prisma schema and migrations
public/               # Static assets (logo, screenshots)
```

## 📝 Notes

- The current repository/package naming may still show `jira-lite-saas`; the product name is `Taska`.
- Realtime collaboration is currently refresh-based.
- The outbox/event pattern is in place for future worker/realtime integrations.
