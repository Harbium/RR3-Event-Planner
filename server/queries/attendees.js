import { supabase } from '../supabase.js';

// Escape characters that mean something in a LIKE pattern so a search for "50%" finds "50%", not everything.
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Find people by name (names and dietary needs only, never contact details).
// With eventId, each result says whether they are already registered for that event.
export async function searchAttendees({ search, eventId, limit }) {
  const { data, error } = await supabase
    .from('attendees')
    .select('attendee_id, attendee_name, attendee_requirements ( requirement_id, dietary_requirements ( requirement_name ) )')
    .ilike('attendee_name', `%${likeEscape(search)}%`)
    .order('attendee_name')
    .order('attendee_id')
    .limit(limit);
  if (error) throw error;

  let registered = new Set();
  if (eventId && data.length) {
    const { data: rows, error: regError } = await supabase
      .from('event_attendees')
      .select('attendee_id')
      .eq('event_id', eventId)
      .in('attendee_id', data.map((a) => a.attendee_id));
    if (regError) throw regError;
    registered = new Set(rows.map((r) => r.attendee_id));
  }

  return data.map((a) => ({
    id: a.attendee_id,
    name: a.attendee_name,
    dietary: a.attendee_requirements.map((r) => r.dietary_requirements.requirement_name).sort(),
    dietaryIds: a.attendee_requirements.map((r) => r.requirement_id).sort((x, y) => x - y),
    ...(eventId ? { registeredForEvent: registered.has(a.attendee_id) } : {}),
  }));
}

// Dietary requirements to pick from, for forms.
export async function listDietaryRequirements() {
  const { data, error } = await supabase
    .from('dietary_requirements')
    .select('requirement_id, requirement_name')
    .order('requirement_id');
  if (error) throw error;
  return data.map((r) => ({ id: r.requirement_id, name: r.requirement_name }));
}
