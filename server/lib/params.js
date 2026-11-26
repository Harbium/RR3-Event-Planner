// Validation of URL / query-string input. Everything from the client arrives as a string.
import { HttpError } from './http.js';

const bad = (message) => new HttpError(400, message);

export function parseId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw bad(`${name} must be a positive integer`);
  return n;
}

function text(query, name) {
  const v = query[name];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw bad(`${name} must be a single value`);
  return v;
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw bad(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

// 'YYYY-MM-DD' -> Date at 00:00 UTC (a day is close enough for filtering events)
function parseDay(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad(`${name} must look like YYYY-MM-DD`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw bad(`${name} is not a real date`);
  return d;
}

// ?from=YYYY-MM-DD&to=YYYY-MM-DD for report endpoints. Returns the same strings (validated) or undefined.
export function parseDateRange(query) {
  const from = text(query, 'from');
  const to = text(query, 'to');
  if (from) parseDay(from, 'from');
  if (to) parseDay(to, 'to');
  return { from, to };
}

export function parsePaging(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw bad(`limit must be a whole number from 1 to ${maxLimit}`);
  }
  if (!Number.isInteger(offset) || offset < 0) throw bad('offset must be a whole number, 0 or more');
  return { limit, offset };
}

// Filters shared by GET /api/events and GET /api/reports/events
//   when=upcoming|past|all   (default upcoming)   from=YYYY-MM-DD   to=YYYY-MM-DD (inclusive)
//   location=<location id>   limit, offset
export function parseEventFilters(query, { defaultWhen = 'upcoming', defaultLimit = 20, maxLimit = 100 } = {}) {
  const when = oneOf(text(query, 'when') ?? defaultWhen, ['upcoming', 'past', 'all'], 'when');
  const from = text(query, 'from');
  const to = text(query, 'to');
  const location = text(query, 'location');
  const toDate = to ? parseDay(to, 'to') : null;
  if (toDate) toDate.setUTCDate(toDate.getUTCDate() + 1); // "to" includes the whole day
  return {
    when,
    from: from ? parseDay(from, 'from').toISOString() : null,
    to: toDate ? toDate.toISOString() : null,
    locationId: location ? parseId(location, 'location') : null,
    ...parsePaging(query, { defaultLimit, maxLimit }),
  };
}

// Body of POST /api/events/:id/walk-ins
//   { name: "Sam Taylor", dietary: [1, 6], mealId: 2 }     a new person
//   { attendeeId: 123, mealId: 2 }                         someone already in the system
// mealId is optional (null = no meal chosen).
export function parseWalkIn(body) {
  const b = body ?? {};
  const hasName = b.name !== undefined && b.name !== null && b.name !== '';
  const hasId = b.attendeeId !== undefined && b.attendeeId !== null;
  if (hasName === hasId) throw bad('Send either a name (new person) or an attendeeId (existing person)');

  let name = null;
  if (hasName) {
    if (typeof b.name !== 'string') throw bad('name must be text');
    name = b.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 100) throw bad('name must be 2 to 100 characters');
  }

  const dietary = b.dietary ?? [];
  if (!Array.isArray(dietary) || dietary.length > 20) throw bad('dietary must be a list of requirement ids');
  if (hasId && dietary.length > 0) throw bad('dietary is only for new people; existing people keep their saved requirements');

  return {
    name,
    attendeeId: hasId ? parseId(b.attendeeId, 'attendeeId') : null,
    mealId: b.mealId === undefined || b.mealId === null ? null : parseId(b.mealId, 'mealId'),
    requirementIds: [...new Set(dietary.map((d) => parseId(d, 'dietary id')))],
  };
}
