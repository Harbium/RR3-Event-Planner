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
