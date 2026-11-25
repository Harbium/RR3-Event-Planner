// Database rows -> the JSON shape the frontend uses. If the schema changes, change it here only.

// row from the event_summary view
export const toEvent = (row) => ({
  id: row.event_id,
  name: row.name,
  start: row.event_start_datetime, // ISO timestamp with offset; format for Europe/London in the UI
  end: row.event_end_datetime,
  location: {
    id: row.location_id,
    name: row.location_venue_name,
    city: row.location_city,
    postcode: row.location_postcode,
  },
  capacity: row.capacity,
  predicted: row.predicted_attendance,
  registered: row.registered,
  attended: row.attended,
  volunteers: { needed: row.volunteers_needed, booked: row.volunteers_booked },
});

// row from event_attendees with attendees / requirements / meal embedded
export const toAttendee = (row) => ({
  id: row.attendees.attendee_id,
  name: row.attendees.attendee_name,
  dietary: (row.attendees.attendee_requirements ?? [])
    .map((r) => r.dietary_requirements.requirement_name)
    .sort(),
  meal: row.event_meals?.meals?.meal_name ?? null,
  attended: row.attended,
  registeredAt: row.registered_at,
});
