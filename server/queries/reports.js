import { supabase } from '../supabase.js';
import { fetchAll } from './db.js';

const pct = (part, whole) => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : null); // 1 decimal place

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

// ---- time series & comparisons (all past events) ----------------------------------------

// One row per month: attendance, capacity, rates, forecasts and volunteer coverage.
export async function getMonthly(range) {
  const rows = await fetchAll('report_monthly', '*', { orderBy: 'month', dateColumn: 'month', ...range });
  return rows.map((r) => ({
    month: r.month, // 'YYYY-MM-01'
    events: r.events,
    registered: r.registered,
    attended: r.attended,
    capacity: r.capacity,
    predicted: r.predicted,
    fillRate: pct(r.registered, r.capacity), // registered / capacity
    showRate: pct(r.attended, r.registered), // attended / registered
    volunteersNeeded: r.volunteers_needed,
    volunteersBooked: r.volunteers_booked,
    understaffedEvents: r.understaffed_events,
    understaffedRate: pct(r.understaffed_events, r.events),
  }));
}

// One row per venue: fill, show rate, volunteer coverage and forecast error.
export async function getVenues() {
  const rows = await fetchAll('report_venue_performance', '*', { orderBy: 'location_id' });
  return rows
    .map((v) => ({
      id: v.location_id,
      name: v.name,
      city: v.city,
      events: v.events,
      registered: v.registered,
      attended: v.attended,
      capacity: v.capacity,
      fillRate: v.fill_rate,
      showRate: v.show_rate,
      understaffedRate: v.understaffed_rate,
      staffBias: v.staff_bias, // % : + means staff over-predict attendance at this venue
      staffMape: v.staff_mape, // % average error of the recorded staff forecast
      modelMape: v.model_mape, // % average error of the history-based model (same events)
    }))
    .sort((a, b) => b.events - a.events);
}

// Forecast error per quarter: recorded staff forecast vs the history-based model.
export async function getForecastAccuracy() {
  const rows = await fetchAll('report_forecast_accuracy_quarterly', '*', { orderBy: 'quarter' });
  return rows.map((r) => ({
    quarter: r.quarter, // first day of the quarter
    events: r.events,
    staffMape: r.staff_mape,
    modelMape: r.model_mape,
    staffBias: r.staff_bias,
    modelBias: r.model_bias,
  }));
}

// Meals by month, tidy rows: chosen (booked) / eaten (attended) / stock (prepared).
export async function getMealsMonthly(range) {
  const rows = await fetchAll('report_meal_monthly', '*', {
    orderBy: ['month', 'meal_id'], dateColumn: 'month', ...range,
  });
  return rows.map((r) => ({
    month: r.month, mealId: r.meal_id, mealName: r.meal_name,
    chosen: r.chosen, eaten: r.eaten, stock: r.stock,
  }));
}

// Dietary demand: by month and by venue (registrations carrying each requirement).
export async function getDietary(range) {
  const [monthly, byVenue] = await Promise.all([
    fetchAll('report_dietary_monthly', '*', { orderBy: ['month', 'requirement_id'], dateColumn: 'month', ...range }),
    fetchAll('report_dietary_venue', '*', { orderBy: ['location_id', 'requirement_id'] }),
  ]);
  return {
    monthly: monthly.map((r) => ({
      month: r.month, requirementId: r.requirement_id, name: r.requirement_name,
      registered: r.registered, attended: r.attended, totalRegistered: r.total_registered,
      share: pct(r.registered, r.total_registered),
    })),
    byVenue: byVenue.map((r) => ({
      venueId: r.location_id, venue: r.venue, requirementId: r.requirement_id, name: r.requirement_name,
      registered: r.registered, totalRegistered: r.total_registered,
      share: pct(r.registered, r.total_registered),
    })),
  };
}
