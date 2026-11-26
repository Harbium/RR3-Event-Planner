-- Check-in upgrades: walk-ins and arrival times. Run once in the Supabase SQL editor (safe to re-run).
-- Run it BEFORE deploying the API that goes with it: the API reads these columns.

-- 1. Two new columns on the registration table.
--    walk_in       true for people who were added on the day (not registered beforehand)
--    checked_in_at when they were ticked off as arrived (null = not arrived; also null for historic rows)
alter table public.event_attendees
  add column if not exists walk_in boolean not null default false,
  add column if not exists checked_in_at timestamptz;

-- 2. Add a walk-in in one atomic step: (optionally) create the person, register them, mark them arrived.
--    Doing it in the database means two people adding walk-ins at the same moment cannot both take the
--    last portion of a meal: the menu row is locked while we count what is left.
--
--    Either p_attendee_id (someone already in the system) or p_name (a new person) is required.
--    p_requirement_ids are the new person's dietary requirements (ignored for an existing person, whose
--    saved requirements are used). p_meal_id is optional; if given it must be on the event's menu,
--    suit the person's requirements, and still have portions left.
--    Walk-ins are allowed past capacity; the result says so (overCapacity) so the screen can warn.
--    Errors are short codes the API turns into plain-language messages.
create or replace function public.register_walk_in(
  p_event_id        bigint,
  p_name            text    default null,
  p_attendee_id     bigint  default null,
  p_meal_id         bigint  default null,
  p_requirement_ids bigint[] default '{}'
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_attendee   bigint := p_attendee_id;
  v_reqs       bigint[];
  v_capacity   bigint;
  v_stock      bigint;
  v_taken      bigint;
  v_registered bigint;
begin
  select capacity into v_capacity from events where event_id = p_event_id;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001'; end if;

  if v_attendee is null then
    if p_name is null or btrim(p_name) = '' then raise exception 'NAME_REQUIRED' using errcode = 'P0001'; end if;
    v_reqs := coalesce(p_requirement_ids, '{}');
    if exists (select 1 from unnest(v_reqs) r
               where not exists (select 1 from dietary_requirements d where d.requirement_id = r)) then
      raise exception 'BAD_REQUIREMENT' using errcode = 'P0001';
    end if;
  else
    perform 1 from attendees where attendee_id = v_attendee;
    if not found then raise exception 'ATTENDEE_NOT_FOUND' using errcode = 'P0001'; end if;
    if exists (select 1 from event_attendees where event_id = p_event_id and attendee_id = v_attendee) then
      raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
    end if;
    select coalesce(array_agg(requirement_id), '{}') into v_reqs
    from attendee_requirements where attendee_id = v_attendee;
  end if;

  if p_meal_id is not null then
    -- lock this menu row so concurrent walk-ins are counted one after another
    select meal_stock into v_stock from event_meals
      where event_id = p_event_id and meal_id = p_meal_id for update;
    if not found then raise exception 'MEAL_NOT_ON_MENU' using errcode = 'P0001'; end if;

    if exists (select 1 from unnest(v_reqs) r
               where not exists (select 1 from meal_requirements mr
                                 where mr.meal_id = p_meal_id and mr.requirement_id = r)) then
      raise exception 'MEAL_UNSUITABLE' using errcode = 'P0001';
    end if;

    select count(*) into v_taken from event_attendees where event_id = p_event_id and meal_id = p_meal_id;
    if v_taken >= v_stock then raise exception 'MEAL_SOLD_OUT' using errcode = 'P0001'; end if;
  end if;

  if v_attendee is null then
    insert into attendees (attendee_name) values (btrim(p_name)) returning attendee_id into v_attendee;
    insert into attendee_requirements (attendee_id, requirement_id)
      select v_attendee, r from (select distinct unnest(v_reqs) as r) x;
  end if;

  insert into event_attendees (event_id, attendee_id, meal_id, attended, registered_at, walk_in, checked_in_at)
  values (p_event_id, v_attendee, p_meal_id, true, now(), true, now());

  select count(*) into v_registered from event_attendees where event_id = p_event_id;

  return jsonb_build_object(
    'attendeeId', v_attendee,
    'registered', v_registered,
    'capacity', v_capacity,
    'overCapacity', v_registered > v_capacity
  );
end;
$$;

-- Only the API (secret key) may call it, never the browser's public key.
revoke all on function public.register_walk_in(bigint, text, bigint, bigint, bigint[]) from public, anon, authenticated;
grant execute on function public.register_walk_in(bigint, text, bigint, bigint, bigint[]) to service_role;
