// All Supabase access for events. Routes call these; they never build queries themselves.
import { supabase } from '../supabase.js';
import { toEvent, toAttendee } from '../lib/mappers.js';

const SUMMARY_COLUMNS = `
  event_id, name, location_id, location_venue_name, location_city, location_postcode,
  event_start_datetime, event_end_datetime, capacity, predicted_attendance, volunteers_needed,
  registered, attended, volunteers_booked`;

// Page of events. Upcoming = not finished yet, soonest first; past = most recent first.
export async function listEvents({ when, from, to, locationId, limit, offset }) {
  let q = supabase.from('event_summary').select(SUMMARY_COLUMNS, { count: 'exact' });

  const now = new Date().toISOString();
  if (when === 'upcoming') q = q.gte('event_end_datetime', now);
  if (when === 'past') q = q.lt('event_end_datetime', now);
  if (from) q = q.gte('event_start_datetime', from);
  if (to) q = q.lt('event_start_datetime', to);
  if (locationId) q = q.eq('location_id', locationId);

  q = q
    .order('event_start_datetime', { ascending: when !== 'past' })
    .order('event_id', { ascending: true }) // tie-breaker so paging is stable
    .range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data.map(toEvent), total: count };
}

// One event, or null if it does not exist.
export async function getEvent(id) {
  const { data, error } = await supabase
    .from('event_summary')
    .select(SUMMARY_COLUMNS)
    .eq('event_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toEvent(data) : null;
}

// Everyone registered for an event, with dietary requirements and their chosen meal.
export async function getEventAttendees(eventId) {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(`
      attended, registered_at,
      attendees ( attendee_id, attendee_name,
                  attendee_requirements ( dietary_requirements ( requirement_name ) ) ),
      event_meals ( meals ( meal_name ) )
    `)
    .eq('event_id', eventId);
  if (error) throw error;
  return data.map(toAttendee).sort((a, b) => a.name.localeCompare(b.name));
}

// Check an attendee in or out. Returns false if they are not registered for that event.
export async function setAttendance(eventId, attendeeId, attended) {
  const { data, error } = await supabase
    .from('event_attendees')
    .update({ attended })
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .select('attendee_id');
  if (error) throw error;
  return data.length > 0;
}
