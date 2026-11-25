import { Router } from 'express';
import { HttpError } from '../lib/http.js';
import { parseId, parseEventFilters } from '../lib/params.js';
import { listEvents, getEvent, getEventAttendees, setAttendance } from '../queries/events.js';

const router = Router();

// GET /api/events?when=upcoming|past|all&from=&to=&location=&limit=&offset=
// -> { items: [event], total }
router.get('/', async (req, res) => {
  res.json(await listEvents(parseEventFilters(req.query)));
});

// GET /api/events/:id -> event
router.get('/:id', async (req, res) => {
  const event = await getEvent(parseId(req.params.id, 'event id'));
  if (!event) throw new HttpError(404, 'Event not found');
  res.json(event);
});

// GET /api/events/:id/attendees -> [{ id, name, dietary[], meal, attended, registeredAt }]
router.get('/:id/attendees', async (req, res) => {
  const id = parseId(req.params.id, 'event id');
  if (!(await getEvent(id))) throw new HttpError(404, 'Event not found');
  res.json(await getEventAttendees(id));
});

// PATCH /api/events/:id/attendees/:attendeeId   body: { "attended": true|false }  (check-in)
router.patch('/:id/attendees/:attendeeId', async (req, res) => {
  const eventId = parseId(req.params.id, 'event id');
  const attendeeId = parseId(req.params.attendeeId, 'attendee id');
  if (typeof req.body?.attended !== 'boolean') throw new HttpError(400, 'attended must be true or false');

  if (!(await setAttendance(eventId, attendeeId, req.body.attended))) {
    throw new HttpError(404, 'That attendee is not registered for this event');
  }
  res.json({ ok: true, attended: req.body.attended });
});

export default router;
