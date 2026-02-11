# Ongoing ✦
**Ongoing** is a premium task + notes app built around one simple rule: unfinished work should never disappear. Tasks roll forward automatically, notes stay timeless, and progress stays visible.

## Why Ongoing
Most todo apps reset every day, bury unfinished tasks, and blur the line between tasks and notes. Ongoing fixes this by design with rollover tasks, forced decisions, and a dedicated notes timeline.

## Core Features
- Smart Task Rollover: Unfinished tasks automatically carry over to the next day.
- Task Age + Rollover: Every task shows Day X and Rolled X times for accountability.
- Decision Required: Old tasks trigger a forced decision: Do Today, Rescope, or Kill.
- Task Debt: A single number that counts tasks older than 5 days.
- Tasks vs Notes Separation: Tasks are daily and actionable. Notes are timeless.
- History That Tells the Truth: Completed late and killed tasks are visible with reasons.
- Persistent Storage: MongoDB Atlas ready and production friendly.

## Design Direction
Ongoing uses soft, muted colors (Mist, Sage, Blush, Sand, Sky) and a calm, glass-like background. The UI is intentionally quiet to reduce anxiety and keep focus steady.

## Tech Stack
- Frontend: React + Vite + React Router
- Backend: Express (local dev) + Vercel Serverless Functions (production)
- Database: MongoDB Atlas + Mongoose
- UI: Custom CSS (glassmorphism, calm gradients)

## Project Structure
- `client/` Vite React app
- `server/` Express API for local development
- `api/` Vercel Serverless API for production
- `vercel.json` Vercel build and routing config

## Local Development
1) Install dependencies:
```bash
npm install
```

2) Create env files (do not commit these):
```bash
# Repo root
echo MONGO_URL=your_mongodb_connection_string> .env

# Client
echo VITE_API_URL=http://localhost:5000> client/.env
```

3) Start both frontend and backend:
```bash
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:5000`.

## Environment Variables
Root `.env`:
```
MONGO_URL=your_mongodb_connection_string
```

Client `.env`:
```
VITE_API_URL=http://localhost:5000
```

## API Endpoints
Tasks:
```
GET    /api/tasks?view=today|history
POST   /api/tasks
PATCH  /api/tasks   (body: { id, ...updates | action })
DELETE /api/tasks   (query: ?id=...)
```

Notes:
```
GET    /api/notes
POST   /api/notes
PATCH  /api/notes   (body: { id, ...updates })
DELETE /api/notes   (query: ?id=...)
```

### Task Decision Actions
```
PATCH /api/tasks
{
  id: "...",
  action: "do_today"
}

PATCH /api/tasks
{
  id: "...",
  action: "rescope",
  entries: ["New task 1", "New task 2"]
}

PATCH /api/tasks
{
  id: "...",
  action: "kill",
  reason: "No longer aligned",
  note: "Optional details"
}
```

## Notes on Rollover
Tasks completed today stay visible with a line-through. Completed or killed tasks move to History. Notes never appear in Today.

---
Built for calm follow-through.
