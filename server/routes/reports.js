import { Router } from 'express';
import { parseEventFilters } from '../lib/params.js';
import { listEvents } from '../queries/events.js';
import { getOverview, getDietaryByEvent } from '../queries/reports.js';

const router = Router();

// GET /api/reports/overview -> { summary, byLocation[], dietary[] }
// Totals for "past" figures only count events that have finished.
router.get('/overview', async (req, res) => {
  res.json(await getOverview());
});

// GET /api/reports/events?when=past&from=&to=&location=&limit=&offset=
// -> { items: [event + dietary: { requirement: registeredCount }], total }
// Same filters as /api/events, but defaults to past events and is capped at 100 per page.
router.get('/events', async (req, res) => {
  const filters = parseEventFilters(req.query, { defaultWhen: 'past', defaultLimit: 50, maxLimit: 100 });
  const { items, total } = await listEvents(filters);
  const dietary = await getDietaryByEvent(items.map((e) => e.id));
  res.json({ total, items: items.map((e) => ({ ...e, dietary: dietary[e.id] ?? {} })) });
});

export default router;
