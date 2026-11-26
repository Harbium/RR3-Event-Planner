// All Supabase access for events. Routes call these; they never build queries themselves.
import { supabase } from '../supabase.js';
import { toEvent, toAttendee } from '../lib/mappers.js';
import { HttpError } from '../lib/http.js';

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

const ATTENDEE_SELECT = `
  attended, registered_at, walk_in, checked_in_at,
  attendees ( attendee_id, attendee_name,
              attendee_requirements ( dietary_requirements ( requirement_name ) ) ),
  event_meals ( meals ( meal_name ) )
`;

// Everyone registered for an event, with dietary requirements and their chosen meal.
export async function getEventAttendees(eventId) {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(ATTENDEE_SELECT)
    .eq('event_id', eventId);
  if (error) throw error;
  return data.map(toAttendee).sort((a, b) => a.name.localeCompare(b.name));
}

// One registered person (same shape as above), or null.
export async function getEventAttendee(eventId, attendeeId) {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(ATTENDEE_SELECT)
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .maybeSingle();
  if (error) throw error;
  return data ? toAttendee(data) : null;
}

// The event's menu with portions prepared / taken / left, and which dietary requirements each meal suits.
// The walk-in form uses this to offer only sensible meals.
export async function getEventMenu(eventId) {
  const { data, error } = await supabase
    .from('event_meal_summary')
    .select('meal_id, meal_name, meal_stock, chosen')
    .eq('event_id', eventId)
    .order('meal_id');
  if (error) throw error;
  if (data.length === 0) return [];

  const { data: reqs, error: reqError } = await supabase
    .from('meal_requirements')
    .select('meal_id, requirement_id')
    .in('meal_id', data.map((m) => m.meal_id));
  if (reqError) throw reqError;

  return data.map((m) => ({
    id: m.meal_id,
    name: m.meal_name,
    stock: m.meal_stock,
    chosen: m.chosen,
    remaining: Math.max(0, m.meal_stock - m.chosen),
    satisfies: reqs.filter((r) => r.meal_id === m.meal_id).map((r) => r.requirement_id).sort((a, b) => a - b),
  }));
}

// Check an attendee in or out. Returns { checkedInAt } (null when checking out), or null if they are not
// registered for that event. Safe to repeat: checking in someone who is already in keeps their first arrival time.
export async function setAttendance(eventId, attendeeId, attended) {
  if (!attended) {
    const { data, error } = await supabase
      .from('event_attendees')
      .update({ attended: false, checked_in_at: null })
      .eq('event_id', eventId)
      .eq('attendee_id', attendeeId)
      .select('attendee_id');
    if (error) throw error;
    return data.length ? { checkedInAt: null } : null;
  }

  const { data, error } = await supabase
    .from('event_attendees')
    .update({ attended: true, checked_in_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .eq('attended', false) // only change people who are not already in
    .select('checked_in_at');
  if (error) throw error;
  if (data.length) return { checkedInAt: data[0].checked_in_at };

  // nothing changed: either already checked in (fine) or not registered at all
  const { data: existing, error: lookupError } = await supabase
    .from('event_attendees')
    .select('checked_in_at')
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  return existing ? { checkedInAt: existing.checked_in_at } : null;
}

// What the database function raises -> what the person sees. [HTTP status, message]
const WALK_IN_ERRORS = {
  EVENT_NOT_FOUND: [404, 'Event not found'],
  NAME_REQUIRED: [400, "Enter the person's name"],
  ATTENDEE_NOT_FOUND: [404, 'That person was not found'],
  BAD_REQUIREMENT: [400, 'Unknown dietary requirement'],
  ALREADY_REGISTERED: [409, 'This person is already registered for this event. Find them in the list and check them in.'],
  MEAL_NOT_ON_MENU: [409, "That meal is not on this event's menu"],
  MEAL_UNSUITABLE: [409, "That meal does not suit this person's dietary requirements"],
  MEAL_SOLD_OUT: [409, 'That meal has run out. Choose another meal.'],
};

// Register a walk-in and check them in, in one step (see register_walk_in in server/db/checkin.sql).
// Returns { attendee, registered, capacity, overCapacity }.
export async function addWalkIn(eventId, { name, attendeeId, mealId, requirementIds }) {
  const { data, error } = await supabase.rpc('register_walk_in', {
    p_event_id: eventId,
    p_name: name,
    p_attendee_id: attendeeId,
    p_meal_id: mealId,
    p_requirement_ids: requirementIds,
  });
  if (error) {
    const known = WALK_IN_ERRORS[error.message];
    if (known) throw new HttpError(known[0], known[1]);
    throw error;
  }
  return {
    attendee: await getEventAttendee(eventId, data.attendeeId),
    registered: data.registered,
    capacity: data.capacity,
    overCapacity: data.overCapacity,
  };
}
