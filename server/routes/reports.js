import { Router } from 'express';
import { parseEventFilters, parseDateRange, parsePaging } from '../lib/params.js';
import { listEvents } from '../queries/events.js';
import {
  getOverview, getDietaryByEvent, getMonthly, getVenues, getForecastAccuracy, getMealsMonthly, getDietary,
} from '../queries/reports.js';
import { getUpcomingForecast } from '../queries/forecast.js';

const router = Router();

// All report endpoints are read-only. "Past" figures only count events that have finished.
// Time-series endpoints accept ?from=YYYY-MM-DD&to=YYYY-MM-DD to limit the months returned.

// GET /api/reports/overview -> { summary, byLocation[], dietary[] }
router.get('/overview', async (req, res) => {
  res.json(await getOverview());
});

// GET /api/reports/events?when=past&from=&to=&location=&limit=&offset=
// -> { items: [event + dietary: { requirement: registeredCount }], total }
router.get('/events', async (req, res) => {
  const filters = parseEventFilters(req.query, { defaultWhen: 'past', defaultLimit: 50, maxLimit: 100 });
  const { items, total } = await listEvents(filters);
  const dietary = await getDietaryByEvent(items.map((e) => e.id));
  res.json({ total, items: items.map((e) => ({ ...e, dietary: dietary[e.id] ?? {} })) });
});

// GET /api/reports/monthly -> { items: [{ month, events, registered, attended, capacity, fillRate, showRate, ... }] }
router.get('/monthly', async (req, res) => {
  res.json({ items: await getMonthly(parseDateRange(req.query)) });
});

// GET /api/reports/venues -> { items: [{ id, name, events, fillRate, showRate, staffBias, ... }] }
router.get('/venues', async (req, res) => {
  res.json({ items: await getVenues() });
});

// GET /api/reports/forecast-accuracy -> { items: [{ quarter, staffMape, modelMape, staffBias, modelBias }] }
router.get('/forecast-accuracy', async (req, res) => {
  res.json({ items: await getForecastAccuracy() });
});

// GET /api/reports/meals -> { items: [{ month, mealId, mealName, chosen, eaten, stock }] }
router.get('/meals', async (req, res) => {
  res.json({ items: await getMealsMonthly(parseDateRange(req.query)) });
});

// GET /api/reports/dietary -> { monthly: [...], byVenue: [...] }
router.get('/dietary', async (req, res) => {
  res.json(await getDietary(parseDateRange(req.query)));
});

// GET /api/reports/forecast/upcoming?limit=10 -> { method, modelError, items: [{ event, forecast }] }
// Expected attendance, meals and dietary needs for the next events.
router.get('/forecast/upcoming', async (req, res) => {
  const { limit } = parsePaging(req.query, { defaultLimit: 10, maxLimit: 40 });
  res.json(await getUpcomingForecast(limit));
});

export default router;
