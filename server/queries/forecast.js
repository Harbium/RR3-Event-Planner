// Forecast for upcoming events: how many people, which meals, which dietary needs.
// Deliberately simple and explainable (averages of recent history), so it can be described and defended
// in the write-up. The history comes from the forecast_* views in server/db/reports.sql.
import { supabase } from '../supabase.js';
import { fetchAll } from './db.js';

const FALLBACK_FILL = 0.6; // attended / capacity, used only if a venue has no history at all
const FALLBACK_SHOW = 0.775; // attended / registered
const MIN_VENUE_MEAL_SAMPLES = 100; // below this many meal choices, use all venues' habits for that season

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pct1 = (x) => Math.round(x * 1000) / 10;

export const METHOD = {
  attendance:
    "Average attended/capacity of the last 4 events of the same series at the venue (or the venue's last 8 events), times this event's capacity. Range = that +/- the model's recent average error.",
  registrations:
    "Expected attendance divided by the venue's recent show rate, never fewer than the registrations already made, never more than capacity.",
  meals:
    "The venue's meal choices in the same season over the last 24 months, rescaled to the meals on this event's menu (all meals if no menu is planned yet).",
  dietary: "The venue's share of registrations carrying each requirement over the last 12 months.",
};

export async function getUpcomingForecast(limit = 10) {
  const { data: events, error } = await supabase
    .from('forecast_inputs')
    .select('*')
    .order('event_start_datetime', { ascending: true })
    .order('event_id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (events.length === 0) return { method: METHOD, modelError: null, items: [] };

  const [menuRes, mealsRes, mealShares, dietShares, accRes] = await Promise.all([
    supabase.from('event_meals').select('event_id, meal_id, meal_stock').in('event_id', events.map((e) => e.event_id)),
    supabase.from('meals').select('meal_id, meal_name').order('meal_id'),
    fetchAll('forecast_venue_meal_share', '*', { orderBy: ['location_id', 'season', 'meal_id'] }),
    fetchAll('forecast_venue_dietary_share', '*', { orderBy: ['location_id', 'requirement_id'] }),
    supabase.from('report_forecast_accuracy_quarterly').select('events, model_mape').order('quarter', { ascending: false }).limit(4),
  ]);
  for (const r of [menuRes, mealsRes, accRes]) if (r.error) throw r.error;

  // How wrong the model has recently been (weighted by events in each of the last 4 quarters).
  const accRows = accRes.data.filter((r) => r.model_mape != null);
  const accEvents = accRows.reduce((n, r) => n + r.events, 0);
  const modelError = accEvents ? accRows.reduce((s, r) => s + r.model_mape * r.events, 0) / accEvents / 100 : 0.15;

  // Menus per event
  const menus = new Map();
  for (const m of menuRes.data) {
    if (!menus.has(m.event_id)) menus.set(m.event_id, new Map());
    menus.get(m.event_id).set(m.meal_id, m.meal_stock);
  }
  const mealName = new Map(mealsRes.data.map((m) => [m.meal_id, m.meal_name]));

  // Meal habits: venue + season, with an "all venues" fallback per season
  const venueSeason = new Map(); // `${venue}|${season}` -> { total, byMeal: Map }
  const allSeason = new Map(); // season -> { total, byMeal }
  const bump = (map, key, mealId, n) => {
    const e = map.get(key) ?? { total: 0, byMeal: new Map() };
    e.total += n;
    e.byMeal.set(mealId, (e.byMeal.get(mealId) ?? 0) + n);
    map.set(key, e);
  };
  for (const r of mealShares) {
    bump(venueSeason, `${r.location_id}|${r.season}`, r.meal_id, r.chosen);
    bump(allSeason, r.season, r.meal_id, r.chosen);
  }

  // Dietary habits per venue, and across all venues as a fallback
  const dietByVenue = new Map();
  for (const r of dietShares) {
    if (!dietByVenue.has(r.location_id)) dietByVenue.set(r.location_id, []);
    dietByVenue.get(r.location_id).push({ id: r.requirement_id, name: r.requirement_name, share: Number(r.share) });
  }
  const dietAll = new Map();
  let regAll = 0;
  const venueTotals = new Map();
  for (const r of dietShares) {
    venueTotals.set(r.location_id, r.total);
    const d = dietAll.get(r.requirement_id) ?? { id: r.requirement_id, name: r.requirement_name, n: 0 };
    d.n += r.registered;
    dietAll.set(r.requirement_id, d);
  }
  for (const t of venueTotals.values()) regAll += t;
  const dietFallback = [...dietAll.values()].map((d) => ({ id: d.id, name: d.name, share: regAll ? d.n / regAll : 0 }));

  const items = events.map((e) => {
    const fill = Number(e.series_fill ?? e.venue_fill ?? FALLBACK_FILL);
    const show = Number(e.venue_show_rate ?? FALLBACK_SHOW);
    const cap = e.capacity;

    const attended = clamp(Math.round(fill * cap), 0, cap);
    const registered = clamp(Math.max(Math.round(attended / show), e.registered_now), 0, cap);
    const attendedExpected = Math.min(attended, registered);

    // meals
    const menu = menus.get(e.event_id) ?? null;
    const habit = venueSeason.get(`${e.location_id}|${e.season}`);
    const habits = habit && habit.total >= MIN_VENUE_MEAL_SAMPLES ? habit : allSeason.get(e.season);
    const mealIds = menu ? [...menu.keys()] : [...mealName.keys()];
    const weights = mealIds.map((id) => habits?.byMeal.get(id) ?? 0);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const meals = mealIds
      .map((id, i) => {
        const share = wSum > 0 ? weights[i] / wSum : 1 / mealIds.length;
        const expectedChosen = Math.round(registered * share);
        const stock = menu ? menu.get(id) : null;
        return {
          mealId: id,
          name: mealName.get(id),
          share: pct1(share),
          expectedChosen, // people expected to book this meal
          expectedEaten: Math.round(attendedExpected * share), // people expected to actually eat it
          stock, // portions prepared (null until the menu is planned)
          shortfall: stock != null && expectedChosen > stock, // true = likely to run out
        };
      })
      .sort((a, b) => b.expectedChosen - a.expectedChosen);

    // dietary
    const diet = (dietByVenue.get(e.location_id) ?? dietFallback)
      .map((d) => ({ requirementId: d.id, name: d.name, share: pct1(d.share), expectedRegistered: Math.round(registered * d.share) }))
      .filter((d) => d.expectedRegistered > 0)
      .sort((a, b) => b.expectedRegistered - a.expectedRegistered);

    return {
      event: {
        id: e.event_id,
        name: e.name,
        start: e.event_start_datetime,
        end: e.event_end_datetime,
        location: { id: e.location_id, name: e.location_venue_name, city: e.location_city },
        capacity: cap,
        registeredNow: e.registered_now,
        staffPredicted: e.predicted_attendance,
        volunteers: { needed: e.volunteers_needed, booked: e.volunteers_booked },
        menuPlanned: menu != null,
      },
      forecast: {
        attended: attendedExpected,
        attendedRange: [Math.round(attendedExpected * (1 - modelError)), Math.min(cap, Math.round(attendedExpected * (1 + modelError)))],
        registered,
        meals,
        dietary: diet,
      },
    };
  });

  return { method: METHOD, modelError: pct1(modelError), items };
}
