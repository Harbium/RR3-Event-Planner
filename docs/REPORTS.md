# Reports and forecast: what the numbers mean

For anyone reading, building or explaining the reports. The endpoints and their responses are in [`server/API.md`](../server/API.md),
and the chart components are in [`client/src/components/reports/README.md`](../client/src/components/reports/README.md).
This page explains what each number is and how it is worked out.

## Words used everywhere

| Term | Meaning |
|---|---|
| **Registered** | People booked on an event. One person booked on one event is one *registration*. People added on the day as walk-ins count too. |
| **Attended** | Registered people who were ticked off as arrived (walk-ins included). |
| **Past event** | An event that has finished (its end time has gone). Every report figure below is about past events only, unless it says "upcoming". |
| **Fill rate** | Registered divided by capacity. How full events get. |
| **Show rate** | Attended divided by registered. How many booked people actually turn up (the opposite of no-shows). |
| **Series** | Events with the same name at the same venue (for example "Ouseburn Sunday Lunch" at The Cluny). Renaming an event starts a new series. |
| **Months and quarters** | Calendar months and quarters in UK time, shown as the first day (`2025-03-01`). |

All rates are percentages from 0 to 100, to one decimal place.

## What each chart shows

| Chart | Endpoint | Worked out as |
|---|---|---|
| Attendance over time | `/reports/monthly` | Registered and attended people added up per month, plus how many events were held that month. |
| Fill rate and show rate | `/reports/monthly` | Fill rate and show rate per month. |
| Venue comparison | `/reports/venues` | Fill rate and show rate over all past events at each venue. |
| Volunteer coverage | `/reports/monthly` | Volunteer slots needed and booked per month. An event is **short-staffed** when fewer volunteers are booked than needed; the line is the share of that month's events that were. |
| Meal demand | `/reports/meals` | For each meal, its share of that month's meal choices. |
| Meal waste | `/reports/meals` | *Prepared, not eaten* = (portions prepared − meals eaten) ÷ portions prepared. *Prepared, not booked* = (portions prepared − meals booked) ÷ portions prepared. A meal counts as **eaten** when the person who booked it was checked in. |
| Dietary requirements over time, and by venue | `/reports/dietary` | The share of registrations that carry each requirement, per month and per venue. Someone with two requirements counts under both, so the shares add up to more than 100%. |
| Forecast accuracy | `/reports/forecast-accuracy` | Average forecast error per quarter (see below). |
| Forecast bias by venue | `/reports/venues` | Average signed error of the staff forecast at each venue (see below). |
| Upcoming events forecast | `/reports/forecast/upcoming` | See "How the forecast works". |
| Dashboard summary | `/reports/overview`, `/reports/monthly` | Totals over past events; the chart covers the last 12 months. |

## Forecast accuracy

Two forecasts of attendance are compared with what really happened:

- **Staff forecast**: the `predicted_attendance` recorded on each event.
- **History-based model**: worked out for every past event using only earlier events: the average attended-to-capacity ratio of the last 4 events in the same series, or if there are none, of the last 8 events at that venue, multiplied by this event's capacity.

The numbers shown:

- **Average error (MAPE)**: on average, how far each forecast was from the real attendance, as a percentage. Lower is better.
- **Bias**: the same, but keeping the direction. **Plus means the forecast was too high on average, minus means too low.** A venue with a large bias is where staff consistently over- or under-estimate.

Both are compared on the same events, only those that had a model forecast and at least one person attending. Quarters with fewer than 5 such events are left off the chart because the average is not meaningful.

## How the forecast works (upcoming events)

Each upcoming event gets an expected attendance, expected meals and expected dietary needs. It is deliberately simple: averages of recent
history, so it can be explained and checked rather than trusted blindly.

1. **Expected attendance** = capacity × the average attended-to-capacity ratio of the last 4 events in the same series (falling back to the venue's last 8 events; with no history at all, 60%). The **range** shown is that figure plus or minus the model's recent average error, taken from the last 4 quarters of the accuracy figures.
2. **Expected registrations** = expected attendance ÷ the venue's recent show rate (its last 8 events; with no history, 77.5%). This is never less than the registrations already made, and never more than capacity.
3. **Expected meals**: each meal's share of choices at that venue in the **same season** over the last 24 months. Seasons: winter is November to March, summer is June to August, and everything else is "other". If the venue has fewer than 100 recorded choices in that season, the habits of all venues are used instead. The shares are then rescaled across the meals actually on this event's menu (or across all meals if no menu has been planned yet), and applied to the expected registrations. *Expected to book* uses expected registrations; *expected to eat* uses expected attendance.
4. **Expected dietary needs** = expected registrations × the venue's share of registrations carrying each requirement over the last 12 months.
5. **Shortfall warning**: when the event has a menu, a meal is flagged "may run short" if its expected bookings are more than the portions prepared.

## Limits worth knowing

- It is an average of recent history, not machine learning, and it knows nothing about one-off things: bank holidays, weather, a school group, a venue change.
- A new venue or series has little history, so its forecast leans on fallbacks and is rough.
- Registrations already made only act as a floor. As an event gets closer they do not yet pull the forecast up towards the real figure.
- "Eaten" assumes anyone checked in ate the meal they booked. Second helpings and leftovers are not recorded.
- Walk-ins count as registered and attended afterwards, so they slightly raise future forecasts for that venue.

## Where the logic lives

| What | Where |
|---|---|
| Totals, monthly and venue figures, accuracy, dietary and meal history | `server/db/reports.sql` and `server/db/views.sql` (database views, so the API reads small pre-calculated tables) |
| Turning those views into the API responses | `server/queries/reports.js` |
| The upcoming-event forecast | `server/queries/forecast.js` (the constants at the top are the fallbacks above) |
| The charts | `client/src/components/reports/` |
