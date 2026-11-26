import { Router } from 'express';
import { HttpError } from '../lib/http.js';
import { parseId, parseEventFilters, parseWalkIn } from '../lib/params.js';
import {
  listEvents, getEvent, getEventAttendees, getEventMenu, setAttendance, addWalkIn,
} from '../queries/events.js';

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

// GET /api/events/:id/checkin  -> everything the check-in screen needs in ONE request (poll this to keep it live)
// { serverTime, event, counts: { registered, attended, notArrived, walkIns, overCapacity }, attendees: [...], menu: [...] }
// counts are worked out from the same list that is returned, so they can never disagree with it.
router.get('/:id/checkin', async (req, res) => {
  const id = parseId(req.params.id, 'event id');
  const [event, attendees, menu] = await Promise.all([getEvent(id), getEventAttendees(id), getEventMenu(id)]);
  if (!event) throw new HttpError(404, 'Event not found');

  const attended = attendees.filter((a) => a.attended).length;
  res.json({
    serverTime: new Date().toISOString(),
    event,
    counts: {
      registered: attendees.length,
      attended,
      notArrived: attendees.length - attended,
      walkIns: attendees.filter((a) => a.walkIn).length,
      overCapacity: attendees.length > event.capacity,
    },
    attendees,
    menu,
  });
});

// PATCH /api/events/:id/attendees/:attendeeId   body: { "attended": true|false }  (check-in)
// -> { ok, attended, checkedInAt }.  Safe to repeat; checking in someone already in keeps their first arrival time.
router.patch('/:id/attendees/:attendeeId', async (req, res) => {
  const eventId = parseId(req.params.id, 'event id');
  const attendeeId = parseId(req.params.attendeeId, 'attendee id');
  if (typeof req.body?.attended !== 'boolean') throw new HttpError(400, 'attended must be true or false');

  const result = await setAttendance(eventId, attendeeId, req.body.attended);
  if (!result) throw new HttpError(404, 'That attendee is not registered for this event');
  res.json({ ok: true, attended: req.body.attended, checkedInAt: result.checkedInAt });
});

// POST /api/events/:id/walk-ins   body: { name, dietary: [ids], mealId }  or  { attendeeId, mealId }
// Registers someone on the day and checks them in. Allowed on any event, and past capacity (see overCapacity).
// -> 201 { ok, attendee, registered, capacity, overCapacity }.  409 with a plain message if the meal has run
// out, does not suit them, is not on the menu, or they are already registered.
router.post('/:id/walk-ins', async (req, res) => {
  const eventId = parseId(req.params.id, 'event id');
  const input = parseWalkIn(req.body);
  const result = await addWalkIn(eventId, input);
  res.status(201).json({ ok: true, ...result });
});

export default router;
