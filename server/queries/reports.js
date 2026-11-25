import { supabase } from '../supabase.js';

async function rows(view, columns = '*') {
  const { data, error } = await supabase.from(view).select(columns);
  if (error) throw error;
  return data;
}

// Headline numbers + per-venue + dietary demand. Three small reads of pre-aggregated views.
export async function getOverview() {
  const [[o], venues, dietary] = await Promise.all([
    rows('report_overview'),
    rows('report_by_location'),
    rows('report_dietary_summary'),
  ]);

  return {
    summary: {
      totalEvents: o.total_events,
      upcomingEvents: o.upcoming_events,
      pastEvents: o.past_events,
      pastRegistered: o.past_registered,
      pastAttended: o.past_attended,
      pastCapacity: o.past_capacity,
      pastVolunteersNeeded: o.past_volunteers_needed,
      pastVolunteersBooked: o.past_volunteers_booked,
    },
    byLocation: venues
      .map((v) => ({
        id: v.location_id,
        name: v.location_venue_name,
        city: v.location_city,
        events: v.events,
        pastEvents: v.past_events,
        pastRegistered: v.past_registered,
        pastAttended: v.past_attended,
        pastCapacity: v.past_capacity,
      }))
      .sort((a, b) => b.events - a.events),
    dietary: dietary
      .map((d) => ({ id: d.requirement_id, name: d.requirement_name, registered: d.registered, attended: d.attended }))
      .sort((a, b) => b.registered - a.registered),
  };
}

// { eventId: { 'Vegan': 4, 'Halal': 7 } } for a list of events (registered counts).
// Done in chunks so one request never goes past Supabase's 1000-row response limit.
export async function getDietaryByEvent(eventIds) {
  const out = {};
  for (let i = 0; i < eventIds.length; i += 50) {
    const { data, error } = await supabase
      .from('event_dietary_demand')
      .select('event_id, requirement_name, registered')
      .in('event_id', eventIds.slice(i, i + 50));
    if (error) throw error;
    for (const r of data) (out[r.event_id] ??= {})[r.requirement_name] = r.registered;
  }
  return out;
}
