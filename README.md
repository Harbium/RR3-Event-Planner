# RR3 Event Planner

Event management web app. React + Vite frontend, Node + Express API, Supabase (Postgres) database. The frontend is hosted on Vercel.

## Structure

```
client/    React + Vite frontend + Tailwind with Shad-Cn Components in Base UI
server/    Express API
  routes/    HTTP only: read the request, validate it, send the response
  queries/   all Supabase access (one file per area)
  lib/       shared helpers (validation, errors, row -> JSON mappers)
  db/        SQL to run in the Supabase SQL editor (views.sql, security.sql)
  supabase.js  the Supabase client
```

## Setup

Requires Node 24 or newer.

```bash
git clone https://github.com/TheDingusBingus/RR3-Event-Planner.git
cd RR3-Event-Planner
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

Create env files from the examples (never commit them):

- `server/.env`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CLIENT_ORIGIN`
- `client/.env`: `VITE_API_URL` (leave unset locally)

## Database setup (once per Supabase project)

After the schema and data are loaded, run these in the Supabase SQL editor:

1. `server/db/views.sql` - reporting views and indexes the API reads from (safe to re-run).
2. `server/db/security.sql` - turns Row Level Security on for every table so only the API's secret key can read or write.
3. `server/db/reports.sql` - analysis views behind the report charts and the forecast (safe to re-run).

## Running

From the repo root:

```bash
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:3001

Always start it from the root. When adding a package, `cd` into `client/` or `server/` first and run `npm install <package>` there.

### Ensure .env and no node_modules are committed.

## How it works

The frontend calls the API with `/api/...` paths. In development, Vite proxies these to Express, so no CORS setup is needed.

- Pages (what shows at `/events/3`) are handled in the browser by React Router, in `client/src`.
- Data (what `GET /api/events/3` returns) is handled by Express, in `server/`.
- Anything under `/api` is the server. Everything else is a React page.

Database access goes through `server/supabase.js` only. The Supabase secret key stays on the server and is never put in a `VITE_` variable or sent to the browser.

### API

| Endpoint | Returns |
|---|---|
| `GET /api/events?when=upcoming\|past\|all&from=&to=&location=&limit=&offset=` | `{ items: [event], total }` (default: upcoming, 20 per page, max 100) |
| `GET /api/events/:id` | one event |
| `GET /api/events/:id/attendees` | registered people with dietary requirements, meal and `attended` |
| `PATCH /api/events/:id/attendees/:attendeeId` body `{ "attended": true }` | check an attendee in / out |
| `GET /api/reports/overview` | headline totals, per-venue totals, dietary demand |
| `GET /api/reports/events?when=past&limit=` | per-event report rows with dietary counts |
| `GET /api/reports/monthly`, `/venues`, `/forecast-accuracy`, `/meals`, `/dietary` | report time series and comparisons |
| `GET /api/reports/forecast/upcoming?limit=` | expected attendance, meals and dietary needs for the next events |

Full request / response details: [`server/API.md`](server/API.md). Report charts: [`client/src/components/reports/README.md`](client/src/components/reports/README.md).

Errors are always `{ "error": "message" }` with a 400, 404 or 500 status. Timestamps are ISO strings; the UI shows them in Europe/London time.

Live attendee counts: TBD

## Deployment

The API must allow the frontend's origin through CORS (`CLIENT_ORIGIN`). API hosting: TBD.

## Working in the repo

`main` is protected. All changes go through a pull request.

```bash
git switch main && git pull
git switch -c feature/short-description
# commit your work
git push -u origin feature/short-description
```

Open a PR, get a review, squash and merge, delete the branch.

- Branch prefixes: `feature/`, `fix/`, `chore/`
- Keep PRs small, with a clear title (it becomes the commit message).
- Review within a day.

Designer: run `npm run dev`, shad-cn base theme in index.css - custom vars go in tokens.css, and extra base styling goes in global.css inside the layer base {}. Make it your own - so long as it works and make sense.

## Rules

- No direct commits to `main`.
- No `.env` files or secrets in git.
- Commit `package-lock.json`.
- Add any new env variable to the matching `.env.example`.
