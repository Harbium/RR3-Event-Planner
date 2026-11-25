-- Reporting views + indexes for the RR3 Event Planner.
-- Run once in the Supabase SQL editor (safe to re-run). Everything the API aggregates lives
-- here, so Node never has to pull tens of thousands of rows to count them.

-- Indexes for the common lookups (the primary keys already cover event_id lookups).
create index if not exists events_start_idx on public.events (event_start_datetime);
create index if not exists events_location_idx on public.events (location_id);
create index if not exists event_attendees_attendee_idx on public.event_attendees (attendee_id);
create index if not exists event_volunteers_volunteer_idx on public.event_volunteers (volunteer_id);

-- One row per event, with location and live counts. Used by GET /api/events.
create or replace view public.event_summary with (security_invoker = true) as
select e.event_id, e.name, e.location_id,
       l.location_venue_name, l.location_city, l.location_postcode,
       e.event_start_datetime, e.event_end_datetime,
       e.capacity, e.predicted_attendance, e.volunteers_needed,
       coalesce(r.registered, 0) as registered,
       coalesce(r.attended, 0)   as attended,
       coalesce(v.booked, 0)     as volunteers_booked
from public.events e
join public.location l using (location_id)
left join (select event_id, count(*) as registered,
                  count(*) filter (where attended) as attended
           from public.event_attendees group by event_id) r using (event_id)
left join (select event_id, count(*) as booked
           from public.event_volunteers group by event_id) v using (event_id);

-- Meals per event: stock prepared vs chosen vs eaten (waste / demand analysis).
create or replace view public.event_meal_summary with (security_invoker = true) as
select em.event_id, em.meal_id, m.meal_name, em.meal_stock,
       count(ea.attendee_id) as chosen,
       count(*) filter (where ea.attended) as eaten
from public.event_meals em
join public.meals m using (meal_id)
left join public.event_attendees ea
       on ea.event_id = em.event_id and ea.meal_id = em.meal_id
group by em.event_id, em.meal_id, m.meal_name, em.meal_stock;

-- Dietary demand per event (how many registered / attended people have each requirement).
create or replace view public.event_dietary_demand with (security_invoker = true) as
select ea.event_id, ar.requirement_id, dr.requirement_name,
       count(*) as registered,
       count(*) filter (where ea.attended) as attended
from public.event_attendees ea
join public.attendee_requirements ar using (attendee_id)
join public.dietary_requirements dr using (requirement_id)
group by ea.event_id, ar.requirement_id, dr.requirement_name;

-- Headline numbers (single row). "past" = event has finished.
create or replace view public.report_overview with (security_invoker = true) as
select count(*) as total_events,
       count(*) filter (where event_end_datetime >= now()) as upcoming_events,
       count(*) filter (where event_end_datetime <  now()) as past_events,
       coalesce(sum(registered)        filter (where event_end_datetime < now()), 0) as past_registered,
       coalesce(sum(attended)          filter (where event_end_datetime < now()), 0) as past_attended,
       coalesce(sum(capacity)          filter (where event_end_datetime < now()), 0) as past_capacity,
       coalesce(sum(volunteers_needed) filter (where event_end_datetime < now()), 0) as past_volunteers_needed,
       coalesce(sum(volunteers_booked) filter (where event_end_datetime < now()), 0) as past_volunteers_booked
from public.event_summary;

-- Per venue totals.
create or replace view public.report_by_location with (security_invoker = true) as
select location_id, location_venue_name, location_city,
       count(*) as events,
       count(*) filter (where event_end_datetime < now()) as past_events,
       coalesce(sum(registered) filter (where event_end_datetime < now()), 0) as past_registered,
       coalesce(sum(attended)   filter (where event_end_datetime < now()), 0) as past_attended,
       coalesce(sum(capacity)   filter (where event_end_datetime < now()), 0) as past_capacity
from public.event_summary
group by location_id, location_venue_name, location_city;

-- Dietary demand across all events (every requirement listed, even if zero).
create or replace view public.report_dietary_summary with (security_invoker = true) as
select d.requirement_id, d.requirement_name,
       coalesce(sum(x.registered), 0) as registered,
       coalesce(sum(x.attended), 0)   as attended
from public.dietary_requirements d
left join public.event_dietary_demand x using (requirement_id)
group by d.requirement_id, d.requirement_name;
