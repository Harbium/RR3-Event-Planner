# API reference

Base URL in development: `http://localhost:3001/api` (the frontend calls `/api/...` and Vite proxies it).
All responses are JSON. Errors are always `{ "error": "message" }` with status **400** (bad input), **404** (not found) or **500** (server problem).
Timestamps are ISO strings with an offset (`2026-11-29T12:30:00+00:00`); show them in `Europe/London` time (see `client/src/lib/format.js`).
Frontend helpers for every endpoint live in `client/src/api/`.

### `GET /api/health`
-> `{ "ok": true }`. Answers as long as the API is running; it does not touch the database.

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
  "attended": false, "walkIn": false, "checkedInAt": null, "registeredAt": "2026-11-23T16:41:08+00:00" }
```
`checkedInAt` is when they were ticked off (null if not arrived, and for data from before arrival times were recorded). `walkIn` is true for people added on the day.

### `GET /api/events/:id/checkin`
Everything the check-in screen needs in one request; poll this to keep a screen live (the `useCheckIn` hook does).
Counts are worked out from the returned list, so they always agree with it. `menu` is empty if the event has no menu yet.
```json
{ "serverTime": "2026-11-29T12:41:03.512Z",
  "event": { "...": "same shape as GET /api/events/:id" },
  "counts": { "registered": 27, "attended": 3, "notArrived": 24, "walkIns": 1, "overCapacity": false },
  "attendees": [ { "id": 4264, "name": "Alfie Milburn", "dietary": [], "meal": "Lentil Potato Curry",
                   "attended": true, "walkIn": false, "checkedInAt": "2026-11-29T12:30:11+00:00", "registeredAt": "..." } ],
  "menu": [ { "id": 1, "name": "Lentil Potato Curry", "stock": 21, "chosen": 12, "remaining": 9,
              "satisfies": [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14] } ] }
```
`satisfies` lists the dietary requirement ids a meal suits; a meal suits a person when it covers all of theirs.

### `PATCH /api/events/:id/attendees/:attendeeId`
Check someone in or out. Body: `{ "attended": true }` (must be a boolean). -> `{ "ok": true, "attended": true, "checkedInAt": "..." }`.
Safe to repeat: checking in someone who is already in keeps their first arrival time. Checking out clears it. 404 if that person is not registered for the event.

### `POST /api/events/:id/walk-ins`
Register someone on the day and check them in, in one step. Works on any event, at any time, and past capacity.
Body, a new person: `{ "name": "Sam Taylor", "dietary": [1, 6], "mealId": 2 }`; an existing person: `{ "attendeeId": 123, "mealId": 2 }`.
`mealId` is optional. `dietary` is only for new people (existing people keep their saved requirements).
-> **201** `{ "ok": true, "attendee": { ...attendee shape... }, "registered": 28, "capacity": 55, "overCapacity": false }`

Errors are `{ "error": "..." }` with a message written for people:
- **409** "That meal has run out. Choose another meal." / "That meal does not suit this person's dietary requirements" / "That meal is not on this event's menu" / "This person is already registered for this event. Find them in the list and check them in."
- **400** name missing or not 2 to 100 characters, both or neither of `name` and `attendeeId`, unknown dietary requirement.
- **404** event or person not found.

If two walk-ins take the last portion of a meal at the same moment, exactly one succeeds.

## People and reference data

### `GET /api/attendees?search=sam&eventId=752&limit=10`
Find existing people by name (at least 2 characters, limit 1-20, default 10). Names and dietary needs only, never contact details.
With `eventId`, each result says whether they are already registered for that event.
-> `[{ "id": 4264, "name": "Alfie Milburn", "dietary": ["Vegan"], "dietaryIds": [1], "registeredForEvent": true }]`

### `GET /api/dietary-requirements`
-> `[{ "id": 1, "name": "Vegan" }, ...]`. Small and rarely changes, so it is safe to cache.

## Reports (read-only)

"Past" figures only count events that have finished. Rates are percentages (0-100, one decimal). Months and quarters are UK time and given as the first day (`2025-03-01`).
Time-series endpoints (`monthly`, `meals`, `dietary`) accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

### `GET /api/reports/overview`
`{ summary, byLocation: [], dietary: [] }` - headline totals (`totalEvents`, `upcomingEvents`, `pastEvents`, `pastRegistered`, `pastAttended`, ...), per-venue totals and dietary demand.

### `GET /api/reports/events`
Per-event rows with dietary counts. Same filters as `/api/events` but defaults to past events, default limit 50 (max 100). -> `{ items: [event + { dietary: { "Vegan": 4, "Halal": 7 } }], total }`

### `GET /api/reports/monthly`
`{ items: [...] }`, one per month:
```json
{ "month": "2025-03-01", "events": 14, "registered": 905, "attended": 702, "capacity": 1130,
  "predicted": 690, "fillRate": 80.1, "showRate": 77.6, "volunteersNeeded": 98, "volunteersBooked": 91,
  "understaffedEvents": 3, "understaffedRate": 21.4 }
```

### `GET /api/reports/venues`
`{ items: [...] }`, one per venue, busiest first. `staffBias` is the average % by which the recorded staff forecast over (+) or under (-) shoots real attendance; `staffMape` / `modelMape` are average absolute % errors of the staff forecast and the history-based model.
```json
{ "id": 4, "name": "Sunderland Minster", "city": "Sunderland", "events": 135, "registered": 12341, "attended": 9539,
  "capacity": 15860, "fillRate": 77.8, "showRate": 77.3, "understaffedRate": 19.3,
  "staffBias": -6, "staffMape": 9.5, "modelMape": 13 }
```

### `GET /api/reports/forecast-accuracy`
`{ items: [...] }`, one per quarter: `{ "quarter": "2026-07-01", "events": 40, "staffMape": 6.9, "modelMape": 15.1, "staffBias": 1.9, "modelBias": 6 }`

### `GET /api/reports/meals`
Tidy rows (one per month per meal): `{ "month": "2021-12-01", "mealId": 1, "mealName": "Lentil Potato Curry", "chosen": 115, "eaten": 95, "stock": 125 }` -> `{ items: [...] }`
`chosen` = people who booked it, `eaten` = of those, who attended, `stock` = portions prepared.

### `GET /api/reports/dietary`
`{ monthly: [...], byVenue: [...] }`. A "registration" is one person booked on one event; `share` is the % of registrations in that month / venue carrying the requirement.
```json
{ "month": "2021-12-01", "requirementId": 1, "name": "Vegan", "registered": 17, "attended": 13, "totalRegistered": 326, "share": 5.2 }
{ "venueId": 1, "venue": "The Cluny", "requirementId": 1, "name": "Vegan", "registered": 403, "totalRegistered": 6781, "share": 5.9 }
```

### `GET /api/reports/forecast/upcoming?limit=10`
Forecast for the next events (limit 1-40). `modelError` is the model's recent average % error; `method` explains each number in words.
```json
{ "modelError": 11.9,
  "items": [ { "event": { "id": 752, "name": "...", "start": "...", "location": { "id": 7, "name": "...", "city": "..." },
                          "capacity": 55, "registeredNow": 27, "staffPredicted": 32,
                          "volunteers": { "needed": 3, "booked": 3 }, "menuPlanned": true },
               "forecast": { "attended": 31, "attendedRange": [27, 35], "registered": 39,
                             "meals": [ { "mealId": 1, "name": "Lentil Potato Curry", "share": 49,
                                          "expectedChosen": 19, "expectedEaten": 15, "stock": 21, "shortfall": false } ],
                             "dietary": [ { "requirementId": 2, "name": "Vegetarian", "share": 14.4, "expectedRegistered": 6 } ] } } ] }
```
`stock` is null (and `menuPlanned` false) until the event has a menu. `shortfall: true` means expected bookings exceed the portions prepared.
