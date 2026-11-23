import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router()

// columns to select from events_legacy table
const cols = 'id, name, location, event_date, event_time, booked, capacity, predicted, volunteers_needed, volunteers_booked' 

// GET /api/events - get all events
// Returns every event, sorted by date and then time (earliest first)
router.get('/', async (req, res) => {
  const { data, error } = await supabase 
    .from('events_legacy') 
    .select(cols)
    .order ('event_date', { ascending: true })
    .order ('event_time', { ascending: true })

  // Handle errors and return data
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/events/:id - get a single event by ID
router.get('/:id', async (req, res) => {
  // URL parameter is a string, so convert to number and check if it's an integer
  const id = Number (req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({error: 'event ID NaN'})
  }

  const { data, error } = await supabase 
    .from('events_legacy') 
    .select(cols)
    .eq('id', id) // filter by event ID
    .single() // return a single row instead of an array

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/events/:eventId/attendees - get all attendees for a specific event
router.get('/api/events/:eventId/attendees', async (req, res) => {
  const { data, error } = await supabase
    .from('event_attendees') // join event_attendees with attendees and dietary_requirements
    .select(`
      attended,
      attendees (
        attendee_id,
        attendee_name,
        attendee_requirements ( dietary_requirements ( requirement_name ) )
      )
    `) // nested select : follows foreign keys into related tables
    .eq('event_id', req.params.eventId);

  if (error) return res.status(500).json({ error: error.message });

  // Map the data to a more convenient format for the frontend
  res.json(
    data.map((row) => ({
      id: row.attendees.attendee_id,
      name: row.attendees.attendee_name,
      // An attendee can habe multiple dietary requirements, so they are mapped to an array of strings
      dietary: row.attendees.attendee_requirements.map(
        (r) => r.dietary_requirements.requirement_name
      ),
      arrived: row.attended, // attended (database) -> arrived (frontend)
    }))
  );
});

// PATCH /api/events/:eventId/attendees/:attendeeId - update an attendee's arrival status for a specific event
router.patch('/api/events/:eventId/attendees/:attendeeId', async (req, res) => {
  const { data, error } = await supabase
    .from('event_attendees')
    .update({ attended: req.body.arrived }) // update the attended column with the arrived value from the request body
    .eq('event_id', req.params.eventId) // filter by event ID and attendee ID
    .eq('attendee_id', req.params.attendeeId)
    .select(); // return the updated row(s)

  if (error) return res.status(500).json({ error: error.message });
  // If no rows were updated, return a 404 error
  if (!data.length) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router