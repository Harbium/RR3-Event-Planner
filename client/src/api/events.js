import { api } from './client.js'

// ---------------------------------------------------------------------------------------
// API functions. These return exactly what the server sends (see server/API.md):
//   event    { id, name, start, end, location: { id, name, city, postcode }, capacity,
//              predicted, registered, attended, volunteers: { needed, booked } }
//   attendee { id, name, dietary: [string], meal, attended, registeredAt }
// ---------------------------------------------------------------------------------------

// A page of events: { items, total }.  when = 'upcoming' | 'past' | 'all'
export const fetchEvents = ({ when = 'upcoming', limit = 20, offset = 0, location } = {}, options) => {
  const params = new URLSearchParams({ when, limit, offset })
  if (location) params.set('location', location)
  return api(`/events?${params}`, options)
}

export const fetchEvent = (id, options) => api(`/events/${id}`, options)

export const getAttendees = (eventId, options) => api(`/events/${eventId}/attendees`, options)

// Check an attendee in (true) or out (false)
export const setAttendance = (eventId, attendeeId, attended) =>
  api(`/events/${eventId}/attendees/${attendeeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attended }),
  })

// ---- Check-in screen (see docs/CHECKIN.md) --------------------------------------------

// Everything the check-in screen needs in one request:
//   { serverTime, event, counts: { registered, attended, notArrived, walkIns, overCapacity }, attendees, menu }
//   attendee also has { walkIn, checkedInAt };  menu item { id, name, stock, chosen, remaining, satisfies: [requirementId] }
export const getCheckIn = (eventId, options) => api(`/events/${eventId}/checkin`, options)

// Add someone on the day and check them in. body is one of:
//   { name, dietary: [requirementId], mealId }   a new person
//   { attendeeId, mealId }                       someone already in the system
// Rejects with the server's plain-language message (meal run out, already registered, ...).
export const addWalkIn = (eventId, body) =>
  api(`/events/${eventId}/walk-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// Find existing people by name (2+ characters). With eventId, results say registeredForEvent.
// -> [{ id, name, dietary: [name], dietaryIds: [id], registeredForEvent }]
export const searchAttendees = ({ search, eventId, limit = 10 }, options) => {
  const params = new URLSearchParams({ search, limit })
  if (eventId) params.set('eventId', eventId)
  return api(`/attendees?${params}`, options)
}

// [{ id, name }] for dietary checkboxes
export const getDietaryRequirements = (options) => api('/dietary-requirements', options)
