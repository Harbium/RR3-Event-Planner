# Check-in and walk-ins: guide for building the screen

The server and the data hook are done and tested. What is left is the screen. This guide says how to move the current screen onto
the hook, what the finished screen must do, and how to know it is finished.

**Who uses it:** organisers, on the day, usually on a phone, often with patchy signal. Aim for: find the person, tap once, done.

## Start here: move the current screen onto the hook

The check-in screen the app has today loads the list once and never refreshes. It also hides errors (a failed load looks like
"Arrived: 0 / 0"), and the "Attended" number on the event card never moves. `useCheckIn` fixes all of that. Moving to it
is **two files** (`pages/EventInfo.jsx` and `components/CheckIn.jsx`); `EventCard.jsx` and the server do not change.

**The rules**
1. **Call `useCheckIn` once, in the page** (`EventInfo.jsx`), not inside `CheckIn`. One hook is one polling stream, and the event
   card and the list then share the same live data. Calling it in two places doubles the requests and the two can disagree.
2. **The page no longer fetches the event itself.** The hook returns it as `checkIn.event`, so remove `useFetch(fetchEvent)` from this page.
3. **Pass the live counts to the event card**, so its "Registered" and "Attended" move when someone is ticked.
4. **Make `CheckIn` only show things.** It receives the hook's result as a prop. Its own `useState`, `useEffect`, `toggle`
   and `getAttendees` call all go; `setAttended` replaces `toggle`.
5. **Show the feedback the hook gives you:** `saving[id]` (disable that row's button), `saveErrors[id]` (say it did not save and
   offer a retry) and `connectionLost` (say the screen is out of date).

**`pages/EventInfo.jsx`**: today it is:

```jsx
import { useParams } from 'react-router'
import { fetchEvent } from '../api/events.js'
import { useFetch } from '../hooks/useFetch.js'
import EventCard from '../components/EventCard.jsx'
import CheckIn from '../components/CheckIn.jsx'

export default function EventInfomation() {
  const { id } = useParams() // use id param from URL
  const { data: event, loading, error } = useFetch(
    (opts) => fetchEvent(id, opts),
    [id]
  )

  if (loading) return <p>Loading event...</p>
  if (error) return <p>Could not load event: {error}</p>

  return (
    <>
      <EventCard event = {event} />
      <CheckIn eventId = {event.id}/>
      
    </>
  )
}
```

after the change:

```jsx
import { useParams } from 'react-router'
import { useCheckIn } from '../hooks/useCheckIn.js'
import EventCard from '../components/EventCard.jsx'
import CheckIn from '../components/CheckIn.jsx'

export default function EventInfomation() {
  const { id } = useParams() // use id param from URL

  // ONE hook for the whole page, so the event card and the check-in list share the same live data
  const checkIn = useCheckIn(id)

  if (checkIn.loading) return <p>Loading event...</p>
  if (checkIn.error) return <p>Could not load event: {checkIn.error}</p>

  // the card shows the live counts, so it moves when someone is ticked; everything else is the event as before
  const event = { ...checkIn.event, registered: checkIn.counts.registered, attended: checkIn.counts.attended }

  return (
    <>
      <EventCard event = {event} />
      <CheckIn checkIn = {checkIn} />
    </>
  )
}
```

**`components/CheckIn.jsx`**: replace the whole file with this (same markup and components as before, now driven by the hook):

```jsx
import { Button } from "./ui/button";
import { Card, CardTitle, CardContent, CardDescription, CardHeader } from "./ui/card";

// Only shows things. The loading, refreshing and saving all live in useCheckIn, which the page calls once.
export default function CheckIn({ checkIn }) {
  const { attendees, counts, saving, saveErrors, setAttended, connectionLost, lastUpdated } = checkIn;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check In</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription aria-live="polite">Arrived: {counts.attended} / {counts.registered}</CardDescription>
        {connectionLost && (
          <p role="alert">
            No connection. Showing the last update at {lastUpdated?.toLocaleTimeString("en-GB")}. Changes may not be saved.
          </p>
        )}
        <ul>
          {attendees.map((p) => (
            <li key={p.id}>
              <span>
                {p.name} {p.dietary.length > 0 && `(${p.dietary.join(", ")})`}
              </span>
              <Button size="sm" disabled={saving[p.id]} onClick={() => setAttended(p.id, !p.attended)}>
                {p.attended ? "Undo" : "Arrived"}
              </Button>
              {saveErrors[p.id] && (
                <Button size="sm" variant="outline" onClick={() => setAttended(p.id, saveErrors[p.id].wanted)}>
                  Not saved. Tap to retry
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

This exact code has been tested in a browser against the real API, in React's development mode (the app uses `StrictMode`).

**Check it worked** (browser DevTools, Network tab, filter `checkin`)
- Opening an event page makes a `checkin` request about every 4 seconds, and **no** request for `/events/:id` or `/attendees` (the hook gets everything from `checkin`).
- Ticking someone updates the list **and** the card's "Attended" straight away.
- With the page open in two windows, a tick in one shows in the other within about 4 seconds.
- An event that does not exist shows "Could not load event", not an empty list.
- Airplane mode shows the "No connection" notice, and it goes away by itself when the connection returns.

**If the screen shows "0 / 0" or an error:** look at the API terminal. The real error is printed there. The usual cause is that
`server/db/checkin.sql` has not been run in Supabase yet.

When that works, carry on with the rest of this guide: search, meals, and adding walk-ins.

## What already exists

| Piece | Where | What it gives you |
|---|---|---|
| `useCheckIn(eventId)` | `client/src/hooks/useCheckIn.js` | Live data and actions (below). **Start here.** |
| API functions | `client/src/api/events.js` | `searchAttendees`, `getDietaryRequirements`, plus what the hook uses |
| Endpoints | `server/API.md` | `GET /events/:id/checkin`, `PATCH .../attendees/:id`, `POST /events/:id/walk-ins`, `GET /attendees?search=`, `GET /dietary-requirements` |
| Database | `server/db/checkin.sql` | `walk_in` and `checked_in_at` columns, and the walk-in function |

Check-in and walk-ins work on **any** event, past or future, at any time. That is deliberate, so the demo can use them.

## The hook

```jsx
const {
  event, menu, attendees, counts,       // what to show
  loading, error, connectionLost, lastUpdated,   // how healthy the data is
  saving, saveErrors,                   // per-person save state
  setAttended, addWalkIn, refresh,      // actions
} = useCheckIn(eventId)
```

Full field descriptions are in the comment at the top of the hook. It already:
- loads everything in one request and **refreshes every 4 seconds** while the tab is visible (and immediately when the tab returns or the network comes back), so several devices stay in step. Do not add your own timers or extra fetches.
- ticks someone **instantly** on screen, then saves; if the save fails the tick is undone and `saveErrors[id]` explains.
- never lets a refresh that was already on its way undo a tick you just made.
- works out `counts` from the list you render, so the numbers and the list always agree.

Smallest possible use:

```jsx
function CheckInScreen({ eventId }) {
  const c = useCheckIn(eventId)
  if (c.loading) return <p>Loading...</p>
  if (c.error) return <p role="alert">{c.error}</p>

  return (
    <>
      <p aria-live="polite">{c.counts.attended} of {c.counts.registered} arrived</p>
      {c.attendees.map((a) => (
        <div key={a.id}>
          {a.name} {a.meal && `· ${a.meal}`}
          <button disabled={c.saving[a.id]} onClick={() => c.setAttended(a.id, !a.attended)}>
            {a.attended ? 'Undo' : 'Arrived'}
          </button>
          {c.saveErrors[a.id] && (
            <button onClick={() => c.setAttended(a.id, c.saveErrors[a.id].wanted)}>Not saved, tap to retry</button>
          )}
        </div>
      ))}
    </>
  )
}
```

## What the screen must do

**Header**
- Arrived / registered (e.g. "12 of 40 arrived"), the number of walk-ins, and a clear notice when `counts.overCapacity` is true ("Over capacity: 42 booked for 40 places"). Over capacity is allowed; it is a notice, not a block.
- "Updated 12 seconds ago" from `lastUpdated`. If `connectionLost`, say so plainly ("No connection. Showing the last update at 14:02. Changes may not be saved") and keep the list on screen.

**The list**
- Search box that filters the list as you type (filter `attendees` locally; the list is at most a few hundred people).
- Each row: name, meal, dietary needs, whether they are in, a **walk-in** tag where `walkIn` is true, and the arrival time (`checkedInAt`) if there is one.
- One big button per row (44px minimum). Show the state in **words** ("Arrived" / "Not arrived"), not colour alone.
- While `saving[id]` is true, disable that row's button only. Everyone else stays tappable.
- If `saveErrors[id]` exists, show its `message` and a retry that calls `setAttended(id, saveErrors[id].wanted)`. Use plain words: "Not saved. Tap to retry."

**Adding a walk-in** (a button that opens a form or dialog)
1. **Search first.** Type 2+ characters, wait about 250ms after the last keystroke, call `searchAttendees({ search, eventId })`. Each result has `registeredForEvent`; if true, show "Already registered" and do not offer to add them (point them at the list instead).
2. If they are an existing person, choose them; their saved dietary needs are used automatically.
3. Otherwise "Add as a new person": a name (required, 2 to 100 characters) and dietary checkboxes from `getDietaryRequirements()` (cache it; it rarely changes).
4. **Choose a meal** from `menu`. Only offer meals that suit the person: a meal's `satisfies` lists the requirement ids it covers, so a meal is suitable when every one of the person's requirement ids is in it. Disable meals with `remaining === 0` and show "Run out". Showing the remaining count helps ("5 left"). A meal is optional.
5. Submit with `addWalkIn({ name, dietary, mealId })` or `addWalkIn({ attendeeId, mealId })`. They are registered and marked arrived in one step and appear in the list immediately.
6. If the promise rejects, show the error message **exactly as it comes back**; it is already written for people ("That meal has run out. Choose another meal."). Keep the form open so they can fix it. After a success with `overCapacity: true`, show the over-capacity notice.

**If the menu is empty** (`menu.length === 0`), hide the meal choice; walk-ins then have no meal.

## Things to know

- **Two people tapping the same name** is safe: each tap sets "arrived" or "not arrived" explicitly, rather than flipping it. The next refresh shows both devices the same thing.
- **"Not saved" can occasionally be wrong.** If a request times out, the server may still have saved it. The next refresh corrects the screen; do not warn people they must re-do it.
- **The last portion of a meal is protected on the server.** If two walk-ins pick the same last portion at once, one succeeds and the other gets the "run out" message. The screen should expect that.
- **Arrival time** is only recorded for check-ins made after this feature went live; older data has none.
- **Walk-ins count as registered and attended** in the reports and charts.
- The API has no login yet (see the README). Anyone who can reach it can check people in.

## Accessibility (matches the design spec)

- Buttons 44px high (the global CSS already does this for `button`).
- Announce changes to the counts with `aria-live="polite"`.
- Errors in an element with `role="alert"`.
- Focus rings stay visible; the form is usable with the keyboard alone.

## Done when (acceptance checklist)

- [ ] Ticking a person updates the screen instantly and survives a page reload.
- [ ] With the screen open on two devices, a tick on one shows on the other within about 5 seconds, with no interaction.
- [ ] Turning on airplane mode shows the "no connection" notice, keeps the list, and recovers by itself when the connection returns.
- [ ] A failed tick (e.g. airplane mode, then tap) goes back to how it was and shows "Not saved, tap to retry"; the retry works once online.
- [ ] Searching filters the list; a search with no matches says so.
- [ ] A walk-in can be added as a new person with a dietary need, and only suitable meals can be chosen.
- [ ] A walk-in can be added from an existing person found by search; people already registered cannot be added twice.
- [ ] Choosing a meal that has run out shows the server's message and keeps the form open.
- [ ] Going over capacity shows the notice but still works.
- [ ] Counts, list and event card never disagree (the event card should use `event` from the hook, not its own fetch).
- [ ] Works on a phone-sized screen with the keyboard open.
- [ ] No console errors.

## Testing it

Event 752 (or any upcoming event) has registrations and a menu. Use two browser windows to check the two-device behaviour. To
try the "run out" case, add walk-ins against the meal with the fewest `remaining` until it hits 0.
