# API reference

Base URL in development: `http://localhost:3001/api` (the frontend calls `/api/...` and Vite proxies it).
All responses are JSON. Errors are always `{ "error": "message" }` with status **400** (bad input), **404** (not found) or **500** (server problem).
Timestamps are ISO strings with an offset (`2026-11-29T12:30:00+00:00`); show them in `Europe/London` time (see `client/src/lib/format.js`).
Frontend helpers for every endpoint live in `client/src/api/`.

## Events

### `GET /api/events`
A page of events. Query (all optional): `when=upcoming|past|all` (default `upcoming`), `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `location=<id>`, `limit` (1-100, default 20), `offset`.
Upcoming is soonest first, past is most recent first. -> `{ items: [event], total }`

```json
{ "id": 752, "name": "Gosforth Sunday Lunch",
  "start": "2026-11-29T12:30:00+00:00", "end": "2026-11-29T14:30:00+00:00",
  "location": { "id": 7, "name": "Gosforth Methodist Hall", "city": "Newcastle upon Tyne", "postcode": "NE3 1DX" },
  "capacity": 55, "predicted": 32, "registered": 27, "attended": 0,
  "volunteers": { "needed": 3, "booked": 3 } }
```

### `GET /api/events/:id`
One event (same shape). 404 if it does not exist.

### `GET /api/events/:id/attendees`
Everyone registered, sorted by name. `meal` is null if none was chosen. -> `[attendee]`

```json
{ "id": 4264, "name": "Alfie Milburn", "dietary": ["Vegan"], "meal": "Lentil Potato Curry",
  "attended": false, "registeredAt": "2026-11-23T16:41:08+00:00" }
```

### `PATCH /api/events/:id/attendees/:attendeeId`
Check someone in or out. Body: `{ "attended": true }` (must be a boolean). -> `{ "ok": true, "attended": true }`. 404 if that person is not registered for the event.

## Reports (read-only)

"Past" figures only count events that have finished. Rates are percentages (0-100, one decimal). Months and quarters are UK time and given as the first day (`2025-03-01`).
Time-series endpoints (`monthly`, `meals`, `dietary`) accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

### `GET /api/reports/overview`
`{ summary, byLocation: [], dietary: [] }` - headline totals (`totalEvents`, `upcomingEvents`, `pastEvents`, `pastRegistered`, `pastAttended`, ...), per-venue totals and dietary demand.

### `GET /api/reports/events`
Per-event rows with dietary counts. Same filters as `/api/events` but defaults to past events, default limit 50 (max 100). -> `{ items: [event + { dietary: { "Vegan": 4, "Halal": 7 } }], total }`
