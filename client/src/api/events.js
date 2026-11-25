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

// ---------------------------------------------------------------------------------------
// TEMPORARY compatibility layer.
// The current components (EventCard, EventsList, Dashboard, EventInfo) were written for the old
// event shape, so getEvents / getEvent convert the new shape back to it and nothing breaks.
// When a component moves to the new shape, switch it to fetchEvents / fetchEvent. Once nothing
// uses getEvents / getEvent any more, delete this section.
// ---------------------------------------------------------------------------------------
const timeUK = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

const toLegacyEvent = (e) => ({
  id: e.id,
  name: e.name,
  location: e.location.name,
  booked: e.registered,
  date: e.start,
  time: timeUK(e.start),
  capacity: e.capacity,
  predicted: e.predicted,
  volunteers_needed: e.volunteers.needed,
  volunteers_booked_sum: e.volunteers.booked,
  volunteers_booked: null, // volunteer IDs are not part of the event list any more
})

// upcoming events (first 100), old shape
export const getEvents = async (options) =>
  (await fetchEvents({ when: 'upcoming', limit: 100 }, options)).items.map(toLegacyEvent)

// one event, old shape
export const getEvent = async (id, options) => toLegacyEvent(await fetchEvent(id, options))
