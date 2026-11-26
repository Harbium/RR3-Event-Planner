import { Router } from 'express';
import { HttpError } from '../lib/http.js';
import { parseId, parsePaging } from '../lib/params.js';
import { searchAttendees } from '../queries/attendees.js';

const router = Router();

// GET /api/attendees?search=sam&eventId=752&limit=10
// -> [{ id, name, dietary: [names], dietaryIds: [ids], registeredForEvent }]   (registeredForEvent only with eventId)
// Used to find an existing person when adding a walk-in. Names and dietary needs only, no contact details.
router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search.length < 2) throw new HttpError(400, 'search must be at least 2 characters');
  const { limit } = parsePaging(req.query, { defaultLimit: 10, maxLimit: 20 });
  const eventId = req.query.eventId === undefined ? null : parseId(req.query.eventId, 'eventId');
  res.json(await searchAttendees({ search, eventId, limit }));
});

export default router;
