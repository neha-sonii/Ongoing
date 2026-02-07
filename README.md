# Ongoing
**Ongoing** is a premium task and notes app built around one simple idea: unfinished work should never disappear. Tasks roll forward automatically, notes stay timeless, and progress stays visible.

## Why Ongoing
Most todo apps reset every day, bury unfinished tasks, and blur the line between tasks and notes. Ongoing fixes this by design with rollover tasks and a dedicated notes timeline.

## Core Features
- Smart Task Rollover: Unfinished tasks automatically carry over to the next day.
- Tasks vs Notes Separation: Tasks are daily and actionable. Notes are timeless.
- Color-Coded Cards: Pick a soft card color before adding.
- Edit and Delete: Clean, icon-based actions for quick updates.
- Completed Task Archive: Finished tasks are archived in History and shown the next day.
- Persistent Storage: MongoDB Atlas ready and production friendly.

## Tech Stack
- Frontend: React + Vite
- Backend: Express (local dev) + Vercel Serverless Functions (production)
- Database: MongoDB Atlas + Mongoose
- UI: Custom CSS with a clean, editorial aesthetic

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
PATCH  /api/tasks   (body: { id, ...updates })
DELETE /api/tasks   (query: ?id=...)
```

Notes:
```
GET    /api/notes
POST   /api/notes
PATCH  /api/notes   (body: { id, ...updates })
DELETE /api/notes   (query: ?id=...)
```

## Notes on Rollover
Tasks completed today stay visible with a line-through. Completed tasks appear in History the next day. Notes never appear in Today.

---
Built for calm follow-through.
