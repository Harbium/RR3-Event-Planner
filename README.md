# RR3 Event Planner

Event management web app. React + Vite frontend, Node + Express API, Supabase (Postgres) database. The frontend is hosted on Vercel.

## Structure

```
client/    React + Vite frontend + Tailwind with Shad-Cn Components in Base UI
  src/pages/       one file per screen (see "Frontend" below)
  src/components/  building blocks; components/reports/ holds the charts
  src/hooks/       data hooks: useFetch (load once) and useCheckIn (live check-in)
  src/api/         the only place that calls the API
  src/lib/         small helpers (UK time formatting)
server/    Express API
  routes/    HTTP only: read the request, validate it, send the response
  queries/   all Supabase access (one file per area)
  lib/       shared helpers (validation, errors, row -> JSON mappers)
  db/        SQL to run in the Supabase SQL editor (views.sql, security.sql, reports.sql, checkin.sql)
  supabase.js  the Supabase client
docs/      guides: building the check-in screen, what the reports and forecast mean
```

## Documentation

| Read this | For |
|---|---|
| [`server/API.md`](server/API.md) | every endpoint, with example responses |
| [`docs/CHECKIN.md`](docs/CHECKIN.md) | the check-in screen and walk-ins: how to build it on the live hook, and when it is done |
| [`docs/REPORTS.md`](docs/REPORTS.md) | what each report number means and how the forecast is worked out |
| [`client/src/components/reports/README.md`](client/src/components/reports/README.md) | the chart components, their props, and how to restyle them |

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

After the schema and data are loaded, run these in the Supabase SQL editor, **in this order** (`reports.sql` needs `views.sql` first):

1. `server/db/views.sql` - reporting views and indexes the API reads from (safe to re-run).
2. `server/db/security.sql` - turns Row Level Security on for every table so only the API's secret key can read or write.
3. `server/db/reports.sql` - analysis views behind the report charts and the forecast (safe to re-run).
4. `server/db/checkin.sql` - walk-in and arrival-time columns plus the walk-in function (safe to re-run). Run it **before** deploying the API that uses it.

All four are safe to run again. If an endpoint starts returning a server error after an update, check that every script has been run: the real error is printed in the API's terminal (for example `column ... does not exist` or `relation ... does not exist`).

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
| `GET /api/events/:id/checkin` | everything the check-in screen needs in one request (poll it to stay live) |
| `PATCH /api/events/:id/attendees/:attendeeId` body `{ "attended": true }` | check an attendee in / out (records arrival time) |
| `POST /api/events/:id/walk-ins` | add someone on the day and check them in |
| `GET /api/attendees?search=` | find existing people by name (no contact details) |
| `GET /api/dietary-requirements` | dietary requirements for forms |
| `GET /api/reports/overview` | headline totals, per-venue totals, dietary demand |
| `GET /api/reports/events?when=past&limit=` | per-event report rows with dietary counts |
| `GET /api/reports/monthly`, `/venues`, `/forecast-accuracy`, `/meals`, `/dietary` | report time series and comparisons |
| `GET /api/reports/forecast/upcoming?limit=` | expected attendance, meals and dietary needs for the next events |

Full request and response details are in [`server/API.md`](server/API.md); the other guides are listed under Documentation above.

**Security:** the API has no login, by design for now. Anyone who can reach it can read data and use the write endpoints (check-in, walk-ins). If login is added later, add it as middleware in `server/index.js` and protect the write endpoints first.

Errors are always `{ "error": "message" }` with a 400, 404, 409 or 500 status. Timestamps are ISO strings; the UI shows them in Europe/London time.

### Frontend

| Address | Screen |
|---|---|
| `/` | Dashboard: a reports summary, then the next 5 events |
| `/events/:id` | One event: the event card and the check-in list |
| `/reports` | All reports: the forecast and every chart (loaded only when opened) |
| `/style-guide` | Design reference |

How the frontend gets its data:
- Everything goes through `client/src/api/`. `api()` in `client.js` adds the `/api` prefix and turns an error response into an `Error` carrying the server's message. `events.js` and `reports.js` have one function per endpoint.
- `useFetch(fetcher, deps)` loads something once and returns `{ data, loading, error }`. `useCheckIn(eventId)` is for the check-in screen: it keeps the data live (see below).
- Report data is cached for 30 seconds in `api/reports.js`, so several charts on one page share one request.
- Times are shown in UK time through `lib/format.js`, whatever time zone the device is in.
- The dashboard is a stack of sections inside `pages/Dashboard.jsx`; to add one, add a `<section>`. Each section loads its own data. `ReportsSummary` is the reports block; render `Reports` instead to show every chart.

### Live check-in

The check-in screen stays live by asking the server for a fresh copy of the event every 4 seconds, but only while the tab is visible. That is `useCheckIn`, which reads `GET /api/events/:id/checkin`.
Ticking someone updates the screen at once and is then saved; a failed save is undone and reported. Walk-ins (people added on the day) are added with `POST /api/events/:id/walk-ins`.
All of it is explained in [`docs/CHECKIN.md`](docs/CHECKIN.md).

## Deployment

The API must allow the frontend's origin through CORS (`CLIENT_ORIGIN`). API hosting: Render.

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
