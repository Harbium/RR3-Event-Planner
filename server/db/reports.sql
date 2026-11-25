-- Analysis views for the reports + forecast endpoints. Run once in the Supabase SQL editor
-- (after views.sql; safe to re-run). All the heavy lifting is done here so the API only reads
-- small, pre-aggregated tables.
--
-- Conventions:  "past" = event has finished.  Months/quarters are in UK time.
--               Rates are percentages (0-100) rounded to 1 decimal place.

-- ---------------------------------------------------------------------------------------
-- 1. Monthly activity: attendance, capacity, forecasts and volunteer coverage
-- ---------------------------------------------------------------------------------------
create or replace view public.report_monthly with (security_invoker = true) as
select date_trunc('month', s.event_start_datetime at time zone 'Europe/London')::date as month,
       count(*)                          as events,
       sum(s.registered)                 as registered,
       sum(s.attended)                   as attended,
       sum(s.capacity)                   as capacity,
       sum(s.predicted_attendance)       as predicted,
       sum(s.volunteers_needed)          as volunteers_needed,
       sum(s.volunteers_booked)          as volunteers_booked,
       count(*) filter (where s.volunteers_booked < s.volunteers_needed) as understaffed_events
from public.event_summary s
where s.event_end_datetime < now()
group by 1;

-- ---------------------------------------------------------------------------------------
-- 2. Forecast backtest, one row per past event.
--    staff_predicted = the predicted_attendance recorded on the event.
--    model_predicted = a simple data-driven forecast made using ONLY earlier events:
--      average attended/capacity of the last 4 events of the same series at that venue
--      (same name + venue), falling back to the last 8 events at the venue, x this capacity.
-- ---------------------------------------------------------------------------------------
create or replace view public.report_attendance_backtest with (security_invoker = true) as
with e as (
  select event_id, name, location_id, location_venue_name, event_start_datetime,
         capacity, predicted_attendance, registered, attended,
         attended::numeric / nullif(capacity, 0) as attended_fill
  from public.event_summary
  where event_end_datetime < now()
), m as (
  select e.*,
         avg(attended_fill) over (partition by location_id, name
              order by event_start_datetime rows between 4 preceding and 1 preceding) as series_fill,
         avg(attended_fill) over (partition by location_id
              order by event_start_datetime rows between 8 preceding and 1 preceding) as venue_fill
  from e
)
select event_id, location_id, location_venue_name, event_start_datetime, capacity, attended,
       predicted_attendance as staff_predicted,
       round(coalesce(series_fill, venue_fill) * capacity)::int as model_predicted
from m;

-- Forecast error by quarter (events that have a model forecast only, so both columns compare like with like).
-- MAPE = mean absolute % error; bias = mean signed % error (+ means over-predicting).
create or replace view public.report_forecast_accuracy_quarterly with (security_invoker = true) as
select date_trunc('quarter', event_start_datetime at time zone 'Europe/London')::date as quarter,
       count(*) as events,
       round(100 * avg(abs(staff_predicted - attended)::numeric / attended), 1) as staff_mape,
       round(100 * avg(abs(model_predicted - attended)::numeric / attended), 1) as model_mape,
       round(100 * avg((staff_predicted - attended)::numeric / attended), 1)    as staff_bias,
       round(100 * avg((model_predicted - attended)::numeric / attended), 1)    as model_bias
from public.report_attendance_backtest
where attended > 0 and model_predicted is not null
group by 1;

-- ---------------------------------------------------------------------------------------
-- 3. Venue performance (past events)
-- ---------------------------------------------------------------------------------------
create or replace view public.report_venue_performance with (security_invoker = true) as
with v as (
  select location_id, location_venue_name as name, location_city as city,
         count(*) as events, sum(registered) as registered, sum(attended) as attended,
         sum(capacity) as capacity,
         count(*) filter (where volunteers_booked < volunteers_needed) as understaffed_events
  from public.event_summary
  where event_end_datetime < now()
  group by 1, 2, 3
), f as (
  select location_id,
         round(100 * avg((staff_predicted - attended)::numeric / attended), 1)      as staff_bias,
         round(100 * avg(abs(staff_predicted - attended)::numeric / attended), 1)   as staff_mape,
         round(100 * avg(abs(model_predicted - attended)::numeric / attended), 1)   as model_mape
  from public.report_attendance_backtest
  where attended > 0 and model_predicted is not null
  group by 1
)
select v.location_id, v.name, v.city, v.events, v.registered, v.attended, v.capacity,
       round(100.0 * v.registered / nullif(v.capacity, 0), 1)   as fill_rate,
       round(100.0 * v.attended / nullif(v.registered, 0), 1)   as show_rate,
       round(100.0 * v.understaffed_events / v.events, 1)       as understaffed_rate,
       f.staff_bias, f.staff_mape, f.model_mape
from v left join f using (location_id);

-- ---------------------------------------------------------------------------------------
-- 4. Meals by month: chosen (booked), eaten (attended), stock (prepared)
-- ---------------------------------------------------------------------------------------
create or replace view public.report_meal_monthly with (security_invoker = true) as
select date_trunc('month', e.event_start_datetime at time zone 'Europe/London')::date as month,
       x.meal_id, x.meal_name,
       sum(x.chosen) as chosen, sum(x.eaten) as eaten, sum(x.meal_stock) as stock
from public.event_meal_summary x
join public.events e using (event_id)
where e.event_end_datetime < now()
group by 1, 2, 3;

-- ---------------------------------------------------------------------------------------
-- 5. Dietary demand by month and by venue (registrations that carry each requirement;
--    total_registered is the denominator for a share)
-- ---------------------------------------------------------------------------------------
create or replace view public.report_dietary_monthly with (security_invoker = true) as
with reg as (
  select date_trunc('month', e.event_start_datetime at time zone 'Europe/London')::date as month,
         count(*) as total_registered
  from public.event_attendees ea join public.events e using (event_id)
  where e.event_end_datetime < now()
  group by 1
)
select date_trunc('month', e.event_start_datetime at time zone 'Europe/London')::date as month,
       d.requirement_id, d.requirement_name,
       sum(d.registered) as registered, sum(d.attended) as attended, r.total_registered
from public.event_dietary_demand d
join public.events e using (event_id)
join reg r on r.month = date_trunc('month', e.event_start_datetime at time zone 'Europe/London')::date
where e.event_end_datetime < now()
group by 1, 2, 3, r.total_registered;

create or replace view public.report_dietary_venue with (security_invoker = true) as
with reg as (
  select e.location_id, count(*) as total_registered
  from public.event_attendees ea join public.events e using (event_id)
  where e.event_end_datetime < now()
  group by 1
)
select e.location_id, l.location_venue_name as venue,
       d.requirement_id, d.requirement_name,
       sum(d.registered) as registered, r.total_registered
from public.event_dietary_demand d
join public.events e using (event_id)
join public.location l using (location_id)
join reg r using (location_id)
where e.event_end_datetime < now()
group by 1, 2, 3, 4, r.total_registered;

-- ---------------------------------------------------------------------------------------
-- 6. Forecast inputs for upcoming events (the API turns these into meal + dietary numbers)
-- ---------------------------------------------------------------------------------------
create or replace view public.forecast_inputs with (security_invoker = true) as
select u.event_id, u.name, u.location_id, u.location_venue_name, u.location_city,
       u.event_start_datetime, u.event_end_datetime,
       u.capacity, u.predicted_attendance, u.registered as registered_now,
       u.volunteers_needed, u.volunteers_booked,
       case when extract(month from u.event_start_datetime at time zone 'Europe/London') in (11, 12, 1, 2, 3) then 'winter'
            when extract(month from u.event_start_datetime at time zone 'Europe/London') in (6, 7, 8)        then 'summer'
            else 'other' end as season,
       -- attended/capacity of the last 4 events of the same series (name + venue)
       (select avg(q.attended::numeric / nullif(q.capacity, 0)) from (
           select attended, capacity from public.event_summary p
           where p.location_id = u.location_id and p.name = u.name and p.event_end_datetime < now()
           order by p.event_start_datetime desc limit 4) q) as series_fill,
       -- same, over the last 8 events at the venue
       (select avg(q.attended::numeric / nullif(q.capacity, 0)) from (
           select attended, capacity from public.event_summary p
           where p.location_id = u.location_id and p.event_end_datetime < now()
           order by p.event_start_datetime desc limit 8) q) as venue_fill,
       -- share of registered people who turn up, last 8 events at the venue
       (select sum(q.attended)::numeric / nullif(sum(q.registered), 0) from (
           select attended, registered from public.event_summary p
           where p.location_id = u.location_id and p.event_end_datetime < now()
           order by p.event_start_datetime desc limit 8) q) as venue_show_rate
from public.event_summary u
where u.event_end_datetime >= now();

-- Which meals people pick at each venue in each season (last 24 months)
create or replace view public.forecast_venue_meal_share with (security_invoker = true) as
with c as (
  select e.location_id,
         case when extract(month from e.event_start_datetime at time zone 'Europe/London') in (11, 12, 1, 2, 3) then 'winter'
              when extract(month from e.event_start_datetime at time zone 'Europe/London') in (6, 7, 8)        then 'summer'
              else 'other' end as season,
         ea.meal_id, count(*) as chosen
  from public.event_attendees ea
  join public.events e using (event_id)
  where ea.meal_id is not null
    and e.event_end_datetime < now() and e.event_end_datetime >= now() - interval '24 months'
  group by 1, 2, 3
)
select location_id, season, meal_id, chosen,
       chosen::numeric / sum(chosen) over (partition by location_id, season) as share
from c;

-- Share of registrations with each dietary requirement at each venue (last 12 months)
create or replace view public.forecast_venue_dietary_share with (security_invoker = true) as
with reg as (
  select e.location_id, count(*) as total
  from public.event_attendees ea join public.events e using (event_id)
  where e.event_end_datetime < now() and e.event_end_datetime >= now() - interval '12 months'
  group by 1
)
select r.location_id, d.requirement_id, d.requirement_name,
       sum(d.registered) as registered, r.total,
       sum(d.registered)::numeric / r.total as share
from public.event_dietary_demand d
join public.events e using (event_id)
join reg r on r.location_id = e.location_id
where e.event_end_datetime < now() and e.event_end_datetime >= now() - interval '12 months'
group by r.location_id, d.requirement_id, d.requirement_name, r.total;

-- ---------------------------------------------------------------------------------------
-- Lock the new views to the API (same as security.sql does for the first set)
-- ---------------------------------------------------------------------------------------
revoke all on public.report_monthly, public.report_attendance_backtest,
              public.report_forecast_accuracy_quarterly, public.report_venue_performance,
              public.report_meal_monthly, public.report_dietary_monthly, public.report_dietary_venue,
              public.forecast_inputs, public.forecast_venue_meal_share, public.forecast_venue_dietary_share
  from anon, authenticated;
