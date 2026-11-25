-- Lock the database down so ONLY the API server (secret key) can touch it.
--
-- Why: tables created in the dashboard are readable AND writable by anyone who has your project
-- URL and the public (anon) key, because Row Level Security (RLS) is off. This project never
-- uses the browser-side Supabase client, so we can switch RLS on for everything and add no
-- policies. The server's secret key bypasses RLS, so the API keeps working; anon/authenticated
-- get nothing.
--
-- Run once in the Supabase SQL editor. If you ever want the browser to query Supabase directly,
-- you will need to write policies first.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- The reporting views are security_invoker (they respect RLS), but take the grants away too.
revoke all on public.event_summary, public.event_meal_summary, public.event_dietary_demand,
              public.report_overview, public.report_by_location, public.report_dietary_summary
  from anon, authenticated;
