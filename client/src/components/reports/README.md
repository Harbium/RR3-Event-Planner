# Report components

Self-contained charts built with [Recharts](https://recharts.org). Drop any of them into any page: each one fetches its own data
(through `src/api/reports.js`), shows loading / error / empty states, and sits in a `Card`. `components/Reports.jsx` simply
lists them all on one page (`/reports`).

| Component | Shows | Props |
|---|---|---|
| `AttendanceTrendChart` | registered vs attended per month + events held | `from`, `to` |
| `RatesTrendChart` | fill rate and show rate per month | `from`, `to` |
| `VenueComparisonChart` | fill / show rate per venue | - |
| `ForecastAccuracyChart` | staff vs model forecast error per quarter | - |
| `ForecastBiasChart` | does each venue over- or under-predict | - |
| `MealDemandChart` | share of meal choices per month (seasonality) | `from`, `to` |
| `MealWasteChart` | prepared-but-uneaten / unbooked portions | `from`, `to` |
| `DietaryTrendChart` | share of registrations per requirement over time | `top` (default 5), `from`, `to` |
| `DietaryByVenueChart` | dietary mix per venue | `requirements` (names) |
| `VolunteerCoverageChart` | volunteers needed vs booked + % short-staffed events | `from`, `to` |
| `UpcomingForecast` | expected attendance / meals / dietary for the next events | `limit` (default 10) |
| `ReportsSummary` | the dashboard's reports block: four headline numbers, the last 12 months of attendance, and a link to the full reports page | - |

`from` / `to` are `'YYYY-MM-DD'` strings, e.g. `<AttendanceTrendChart from="2025-01-01" />`.

## Styling

- Layout and text come from the existing `Card` and Tailwind classes, so the usual theme applies.
- Series colours use `var(--rpt-1)` ... `var(--rpt-8)` with built-in defaults (colour-blind friendly). **To restyle, define `--rpt-1` to `--rpt-8` in `styles/tokens.css`**; no chart code needs to change.
- Axis text, grid and tooltips follow `--muted-foreground`, `--border` and `--popover`. Shared helpers are in `chartTheme.js`.
- Every chart has `role="img"` with a one-line `aria-label` (the `summary` prop of `ChartCard`).

## Adding a chart

1. Add the data endpoint (see `server/API.md`) and a function in `src/api/reports.js`.
2. Copy a small chart (e.g. `RatesTrendChart.jsx`) and change the data and series.
3. Wrap it in `ChartCard` and list it in `components/Reports.jsx`.

What each chart's numbers mean, and how the forecast is worked out: [`docs/REPORTS.md`](../../../../docs/REPORTS.md).
